import type {
  KalpContext,
  KalpAuth,
  AgentDefinition,
  KalpHistory,
} from "@kalphq/sdk";
import type { EffectResolver, EffectType, EffectMap } from "./types";
import type { ReplayLog, PersistedEffect } from "../state/replay-log";
import type { ExecutionFrame } from "../execution/frame";
import { serializeError } from "../state/replay-log";

import {
  createAIContext,
  createStorageContext,
  createMathContext,
  createTimeContext,
  createMemoryContext,
  createMcpContext,
  createLogContext,
  createVaultContext,
  createActionsContext,
  createRuntimeContext,
  createSchedulesContext,
} from "./primitives";

export function createProxyContext(
  resolver: EffectResolver,
  log: ReplayLog,
  frame: ExecutionFrame,
  onEffectResolved: (effect: PersistedEffect) => Promise<void>,
  agentDefinition: AgentDefinition,
  history: KalpHistory,
  state: Record<string, unknown>,
  localActions: {
    call: (
      listener: any,
      payload: unknown,
      options?: unknown,
    ) => Promise<unknown>;
    dispatch: (
      listener: any,
      payload: unknown,
      options?: unknown,
    ) => Promise<{ eventId: string }>;
  },
  auth?: KalpAuth,
): KalpContext {
  async function interceptEffect<T extends EffectType>(
    type: T,
    payload: EffectMap[T]["payload"],
  ): Promise<EffectMap[T]["result"]> {
    const seq = frame.seqCounter++;
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
      const result = await resolver.resolve(effectData as any);
      await onEffectResolved({ ...effectData, result });
      return result as EffectMap[T]["result"];
    } catch (err) {
      await onEffectResolved({ ...effectData, error: serializeError(err) });
      throw err;
    }
  }

  async function interceptLocalEffect<T>(
    type: "action.call" | "action.dispatch",
    payload: EffectMap[typeof type]["payload"],
    execute: () => Promise<T>,
  ): Promise<T> {
    const seq = frame.seqCounter++;
    const cached = log.get(frame.executionId, seq);
    if (cached) {
      if (cached.error) {
        const error = new Error(cached.error.message);
        error.name = cached.error.name;
        if (cached.error.stack) error.stack = cached.error.stack;
        throw error;
      }
      if (cached.result !== undefined) {
        return cached.result as T;
      }
      return undefined as T;
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
      const result = await execute();
      await onEffectResolved({ ...effectData, result });
      return result;
    } catch (err) {
      await onEffectResolved({ ...effectData, error: serializeError(err) });
      throw err;
    }
  }

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

  const baseTime = interceptSync("time.baseTime", {}, () => Date.now());

  return {
    ai: createAIContext(interceptEffect),
    storage: createStorageContext(interceptEffect),
    state,
    math: createMathContext(interceptSync),
    time: createTimeContext(baseTime),
    memory: createMemoryContext(interceptEffect),
    mcp: createMcpContext(interceptEffect),
    log: createLogContext(interceptSync),
    vault: createVaultContext(interceptEffect),
    actions: createActionsContext(interceptEffect, interceptSync, {
      call: (listener, payload, options) =>
        interceptLocalEffect(
          "action.call",
          {
            listener:
              listener?.__runtimeId ??
              `listener:${listener?.event ?? "unknown"}`,
            data: payload,
            options,
          },
          () => localActions.call(listener, payload, options),
        ),
      dispatch: (listener, payload, options) =>
        interceptLocalEffect(
          "action.dispatch",
          {
            listener:
              listener?.__runtimeId ??
              `listener:${listener?.event ?? "unknown"}`,
            data: payload,
            options,
          },
          () => localActions.dispatch(listener, payload, options),
        ),
    }),
    schedules: createSchedulesContext(interceptEffect),
    runtime: createRuntimeContext({
      runId: frame.executionId,
      executionId: frame.executionId,
      traceId: frame.ctx.traceId,
      threadId: frame.ctx.threadId,
      environment: "dev",
      startedAt: Date.now(),
    }),
    agent: { definition: agentDefinition },
    history,
    auth,
  } as unknown as KalpContext;
}
