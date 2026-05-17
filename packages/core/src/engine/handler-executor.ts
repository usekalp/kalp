/**
 * Handler executor - loads and runs compiled handler bundles.
 *
 * @module
 */

import type {
  BundleManifest,
  BundleNodeBinding,
  IRGraph,
  KalpContext,
  KalpHistoryMessage,
} from "@kalphq/sdk";
import type { RuntimeEvent } from "@/engine/types";
import type { PersistenceAdapter } from "@/adapters/interfaces";
import type { EffectResolver } from "@/effects/types";
import { ReplayLog } from "../state/replay-log";
import { SuspensionException } from "@/engine/suspension";
import { createProxyContext } from "../effects/context";
import type { ExecutionFrame } from "../execution/frame";
import { handleEffect } from "./listener-dispatch";
import { resolveBundleBinding, resolveListenerNodeId } from "./runtime-utils";

const bundleModuleCache = new Map<string, Promise<(payload: unknown, ctx: KalpContext) => unknown>>();

export interface ExecutionResult {
  value?: unknown;
  suspended?: boolean;
  until?: number;
  wakeReason?: string;
}

export type RuntimeBundleLoader = (
  binding: BundleNodeBinding,
  nodeId: string,
) => Promise<string>;

export const AGENT_STATE_STORAGE_KEY = "__kalp_state__";

export async function loadHistory(
  threadId: string,
  persistence: PersistenceAdapter,
): Promise<KalpHistoryMessage[]> {
  if (!threadId) return [];

  try {
    const rawEvents = await persistence.events.loadByThread(threadId);
    return rawEvents
      .filter((e: any) => e.type === "node.completed" || e.type === "action.run.completed")
      .map((e: any) => ({
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

export function resolveSystemPrompt(ir: IRGraph): string {
  const prompt = ir.agent?.systemPrompt;
  if (typeof prompt === "object" && prompt !== null && "dynamic" in prompt) {
    return "";
  }
  return prompt ?? "";
}

export function buildHandlerContext(
  resolver: EffectResolver,
  log: ReplayLog,
  frame: ExecutionFrame,
  history: KalpHistoryMessage[],
  persistence: PersistenceAdapter,
  ir: IRGraph,
  state: Record<string, unknown>,
  localActions: {
    emit: (listener: any, payload: unknown, options?: unknown) => Promise<unknown>;
    dispatch: (listener: any, payload: unknown, options?: unknown) => Promise<void>;
  },
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
    state,
    localActions,
  );
}

export async function loadAgentState(
  persistence: PersistenceAdapter,
): Promise<Record<string, unknown>> {
  const stored = await persistence.state.get(AGENT_STATE_STORAGE_KEY);
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) {
    return {};
  }

  return JSON.parse(JSON.stringify(stored)) as Record<string, unknown>;
}

async function loadHandlerModule(
  binding: BundleNodeBinding,
  nodeId: string,
  bundleLoader: RuntimeBundleLoader,
): Promise<(payload: unknown, ctx: KalpContext) => unknown> {
  const cacheKey = `${binding.sha256}:${nodeId}`;
  if (!bundleModuleCache.has(cacheKey)) {
    bundleModuleCache.set(
      cacheKey,
      (async () => {
        const code = await bundleLoader(binding, nodeId);
        const dataUrl = `data:text/javascript;charset=utf-8,${encodeURIComponent(code)}`;
        const mod = (await import(dataUrl)) as { default?: (payload: unknown, ctx: KalpContext) => unknown };
        if (typeof mod.default !== "function") {
          throw new Error(`Bundle ${binding.bundle} for node ${nodeId} does not export a default handler.`);
        }
        return mod.default;
      })(),
    );
  }

  return bundleModuleCache.get(cacheKey)!;
}

export async function executeHandlerBundle(
  nodeId: string,
  event: RuntimeEvent,
  frame: ExecutionFrame,
  log: ReplayLog,
  persistence: PersistenceAdapter,
  resolver: EffectResolver,
  ir: IRGraph,
  _schemas: Record<string, unknown>,
  bundleManifest: BundleManifest,
  bundleLoader: RuntimeBundleLoader,
  state: Record<string, unknown>,
  historyEntries?: KalpHistoryMessage[],
): Promise<ExecutionResult> {
  const binding = resolveBundleBinding(nodeId, bundleManifest);
  if (!binding) {
    throw new Error(`Execution failed: bundle binding missing for node ${nodeId}.`);
  }

  const history = historyEntries ?? (await loadHistory(frame.ctx.threadId, persistence));

  const localActions = {
    emit: async (listener: any, payload: unknown) => {
      const listenerNodeId = resolveListenerNodeId(listener, ir);
      if (!listenerNodeId) {
        throw new Error(
          `No local listener found for ${listener?.__runtimeId ?? listener?.event ?? "unknown"}`,
        );
      }

      const listenerEvent: RuntimeEvent = {
        type: `listener:${listener?.event ?? "unknown"}` as any,
        payload,
        threadId: frame.ctx.threadId,
        traceId: frame.ctx.traceId,
      };

      const result = await executeHandlerBundle(
        listenerNodeId,
        listenerEvent,
        frame,
        log,
        persistence,
        resolver,
        ir,
        _schemas,
        bundleManifest,
        bundleLoader,
        state,
        history,
      );

      return result.value;
    },
    dispatch: async (listener: any, payload: unknown) => {
      const listenerNodeId = resolveListenerNodeId(listener, ir);
      if (!listenerNodeId) {
        throw new Error(
          `No local listener found for ${listener?.__runtimeId ?? listener?.event ?? "unknown"}`,
        );
      }

      await persistence.events.append({
        type: "listener.queued",
        listenerNodeId,
        payload,
        executionId: frame.executionId,
        traceId: frame.ctx.traceId,
        threadId: frame.ctx.threadId,
        timestamp: Date.now(),
      } as any);
    },
  };

  const ctx = buildHandlerContext(
    resolver,
    log,
    frame,
    history,
    persistence,
    ir,
    state,
    localActions,
  );

  const fn = await loadHandlerModule(binding, nodeId, bundleLoader);

  const isContextOnly =
    event.type === "onInit" ||
    event.type === "onTick" ||
    event.type.startsWith("schedule:");

  try {
    const value = isContextOnly ? await (fn as any)(ctx) : await fn(event.payload, ctx);
    return { value };
  } catch (err: unknown) {
    if (err instanceof SuspensionException) {
      await persistence.events.append({
        type: "execution.suspended",
        nodeId,
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
