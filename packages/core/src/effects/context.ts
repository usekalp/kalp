import type { KalpContext, KalpAuth, AgentIntrospection, KalpHistoryMessage } from "@kalphq/sdk";
import type { EffectResolver, EffectType, EffectMap } from "./types";
import type { ReplayLog, PersistedEffect } from "../state/replay-log";
import type { ExecutionFrame } from "../execution/frame";
import { serializeError } from "../state/replay-log";

import {
  createAIContext,
  createStorageContext,
  createStateContext,
  createMathContext,
  createDateContext,
  createMemoryContext,
  createMcpContext,
  createLogContext,
  createVaultContext,
  createActionsContext,
} from "./primitives";

export function createProxyContext(
  resolver: EffectResolver,
  log: ReplayLog,
  frame: ExecutionFrame,
  onEffectResolved: (effect: PersistedEffect) => Promise<void>,
  agent: AgentIntrospection,
  history: KalpHistoryMessage[],
  auth?: KalpAuth,
): KalpContext {
  // Strongly typed async interceptor
  async function interceptEffect<T extends EffectType>(
    type: T,
    payload: EffectMap[T]["payload"],
  ): Promise<EffectMap[T]["result"]> {
    // SYNCHRONOUS — deterministic sequence assignment
    const seq = frame.seqCounter++;

    // 1. Check replay cache
    const cached = log.get(frame.executionId, seq);
    if (cached) {
      if (cached.error) {
        const error = new Error(cached.error.message);
        error.name = cached.error.name;
        if (cached.error.stack) error.stack = cached.error.stack;
        throw error;
      }
      if (cached.result !== undefined) {
        return cached.result as EffectMap[T]["result"];
      }
    }

    const effectData = {
      type,
      seq,
      payload,
      executionId: frame.executionId,
      traceId: frame.ctx.traceId,
      threadId: frame.ctx.threadId,
      timestamp: Date.now(),
    };

    try {
      // 2. Emit effect → resolver handles it
      const result = await resolver.resolve(effectData as any);

      // 3. PERSIST BEFORE RETURN
      await onEffectResolved({ ...effectData, result });

      return result as EffectMap[T]["result"];
    } catch (err) {
      await onEffectResolved({ ...effectData, error: serializeError(err) });
      throw err;
    }
  }

  // Sync intercept for deterministic pure functions (date, math, logs)
  function interceptSync<T>(
    type: string,
    payload: unknown,
    compute: () => T,
  ): T {
    const seq = frame.seqCounter++;
    const cached = log.get(frame.executionId, seq);
    if (cached?.result !== undefined) {
      return cached.result as T;
    }
    const result = compute();
    // Fire-and-forget to resolver just to log it (using cast because we don't await)
    void (resolver as any)
      .resolve({
        type,
        seq,
        payload,
        executionId: frame.executionId,
        traceId: frame.ctx.traceId,
        threadId: frame.ctx.threadId,
        timestamp: Date.now(),
      })
      .catch(() => {});
    return result;
  }

  // Pre-calculate base time for date operations
  const baseTime = interceptSync("date.baseTime", {}, () => Date.now());

  return {
    ai: createAIContext(interceptEffect),
    storage: createStorageContext(interceptEffect),
    state: createStateContext(interceptEffect),
    math: createMathContext(interceptSync),
    date: createDateContext(baseTime),
    memory: createMemoryContext(interceptEffect),
    mcp: createMcpContext(interceptEffect),
    log: createLogContext(interceptSync),
    vault: createVaultContext(interceptEffect),
    actions: createActionsContext(interceptEffect, interceptSync),
    auth,
    agent,
    history,
  } as unknown as KalpContext;
}
