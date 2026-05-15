/**
 * Handler executor - compiles and runs bundled handler code.
 *
 * @module
 */

import type { IRGraph, KalpContext, KalpHistoryMessage } from "@kalphq/sdk";
import type { RuntimeEvent } from "@/engine/types";
import type { PersistenceAdapter } from "@/adapters/interfaces";
import type { EffectResolver } from "@/effects/types";
import { ReplayLog } from "../state/replay-log";
import { SuspensionException } from "@/engine/suspension";
import { createProxyContext } from "../effects/context";
import type { ExecutionFrame } from "../execution/frame";
import { handleEffect } from "./listener-dispatch";

/**
 * Result of executing a handler.
 */
export interface ExecutionResult {
  value?: unknown;
  suspended?: boolean;
  until?: number;
  wakeReason?: string;
}

/**
 * Loads conversation history from the event store.
 */
export async function loadHistory(
  threadId: string,
  persistence: PersistenceAdapter,
): Promise<KalpHistoryMessage[]> {
  if (!threadId) return [];

  try {
    const rawEvents = await persistence.events.loadByThread(threadId);
    return rawEvents
      .filter((e) => e.type === "node.completed" || e.type === "action.run.completed")
      .map((e) => ({
        role: "assistant" as const,
        content: JSON.stringify({
          type: e.type,
          result: (e as { result?: unknown }).result,
        }),
        timestamp: e.timestamp,
      }));
  } catch {
    return [];
  }
}

/**
 * Resolves the AI system prompt from an agent's IR definition.
 */
export function resolveSystemPrompt(ir: IRGraph): string {
  const prompt = ir.agent?.systemPrompt;
  if (typeof prompt === "object" && prompt !== null && "dynamic" in prompt) {
    return "";
  }
  return prompt ?? "";
}

/**
 * Builds the proxy context with interceptor callbacks.
 */
export function buildHandlerContext(
  resolver: EffectResolver,
  log: ReplayLog,
  frame: ExecutionFrame,
  history: KalpHistoryMessage[],
  persistence: PersistenceAdapter,
  ir: IRGraph,
): KalpContext {
  return createProxyContext(
    resolver,
    log,
    frame,
    (effect) => handleEffect(effect, persistence, ir),
    {
      agentId: ir.agent?.name ?? frame.ctx.threadId ?? "unknown",
      runId: frame.executionId,
      name: ir.agent?.name ?? "unknown",
      systemPrompt: resolveSystemPrompt(ir),
      metadata: {
        label: ir.agent?.label,
        tags: ir.agent?.tags,
        skipAuth: ir.agent?.skipAuth,
      },
    },
    history,
  );
}

/**
 * Executes a compiled handler bundle in an isolated context.
 */
export async function executeHandlerBundle(
  handlerHash: string,
  event: RuntimeEvent,
  frame: ExecutionFrame,
  log: ReplayLog,
  persistence: PersistenceAdapter,
  resolver: EffectResolver,
  ir: IRGraph,
): Promise<ExecutionResult> {
  const bundle = ir.bundles[handlerHash];
  if (!bundle) {
    throw new Error(`Execution failed: Bundle ${handlerHash} not found in IR.`);
  }

  const historyEntries = await loadHistory(frame.ctx.threadId, persistence);
  const ctx = buildHandlerContext(resolver, log, frame, historyEntries, persistence, ir);

  const fn = new Function(`
    ${bundle.code}
    return __handler.default;
  `)();

  const isContextOnly =
    event.type === "onInit" ||
    event.type === "onTick" ||
    event.type.startsWith("schedule:");

  try {
    const value = isContextOnly ? await fn(ctx) : await fn(event.payload, ctx);
    return { value };
  } catch (err) {
    if (err instanceof SuspensionException) {
      await persistence.events.append({
        type: "execution.suspended",
        nodeId: event.type,
        resumeAt: err.resumeAt,
        executionId: frame.executionId,
        traceId: frame.ctx.traceId,
        threadId: frame.ctx.threadId,
        timestamp: Date.now(),
      });

      return {
        suspended: true,
        until: err.resumeAt,
        wakeReason: err.wakeReason,
      };
    }
    throw err;
  }
}