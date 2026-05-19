import type { EffectResolver, EffectType, Effect, EffectMap } from "./types";
import type { ReplayLog, PersistedEffect } from "../state/replay-log";
import type { ExecutionFrame } from "../execution/frame";
import { serializeError } from "../state/replay-log";

/**
 * Create an async effect interceptor that records each effect to the replay log and delegates
 * resolution to the provided resolver. Supports deterministic replay by returning cached results
 * when the same effect sequence is replayed.
 *
 * @param resolver - Effect resolver that processes each effect.
 * @param log - Replay log for caching and deterministic replay.
 * @param frame - Current execution frame providing sequence counters and tracing context.
 * @param onEffectResolved - Callback invoked after each effect is persisted.
 * @returns A function that intercepts an effect by type and payload, returning the resolved result.
 */
export function createInterceptEffect(
  resolver: EffectResolver,
  log: ReplayLog,
  frame: ExecutionFrame,
  onEffectResolved: (effect: PersistedEffect) => Promise<void>,
): <T extends EffectType>(type: T, payload: EffectMap[T]["payload"]) => Promise<EffectMap[T]["result"]> {
  return async <T extends EffectType>(
    type: T,
    payload: EffectMap[T]["payload"],
  ): Promise<EffectMap[T]["result"]> => {
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
      const result = await resolver.resolve(effectData as Effect<T>);
      await onEffectResolved({ ...effectData, result });
      return result as EffectMap[T]["result"];
    } catch (err) {
      await onEffectResolved({ ...effectData, error: serializeError(err) });
      throw err;
    }
  };
}

/**
 * Create an async interceptor for local effects (action.call and action.dispatch) that records
 * the effect to the replay log and invokes a local execution function to produce the result.
 * Supports deterministic replay via cached results.
 *
 * @param resolver - Effect resolver that processes each effect.
 * @param log - Replay log for caching and deterministic replay.
 * @param frame - Current execution frame providing sequence counters and tracing context.
 * @param onEffectResolved - Callback invoked after each effect is persisted.
 * @returns A function that intercepts a local effect, executes it locally, and returns the result.
 */
export function createInterceptLocalEffect(
  _resolver: EffectResolver,
  log: ReplayLog,
  frame: ExecutionFrame,
  onEffectResolved: (effect: PersistedEffect) => Promise<void>,
): <T>(type: "action.call" | "action.dispatch", payload: EffectMap[typeof type]["payload"], execute: () => Promise<T>) => Promise<T> {
  return async <T>(
    type: "action.call" | "action.dispatch",
    payload: EffectMap[typeof type]["payload"],
    execute: () => Promise<T>,
  ): Promise<T> => {
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
  };
}

/**
 * Create a synchronous effect interceptor that records the effect to the replay log but returns
 * the computed result immediately without awaiting resolver resolution. Used for side-effects
 * that do not require async handling (e.g. logging, math).
 *
 * @param resolver - Effect resolver that processes each effect.
 * @param log - Replay log for caching and deterministic replay.
 * @param frame - Current execution frame providing sequence counters and tracing context.
 * @param onEffectResolved - Callback invoked after each effect is persisted.
 * @returns A function that intercepts a synchronous effect, computes it, and returns the result.
 */
export function createInterceptSync(
  resolver: EffectResolver,
  log: ReplayLog,
  frame: ExecutionFrame,
  onEffectResolved: (effect: PersistedEffect) => Promise<void>,
): <T>(type: string, payload: unknown, compute: () => T) => T {
  return <T>(type: string, payload: unknown, compute: () => T): T => {
    const seq = frame.seqCounter++;
    const cached = log.get(frame.executionId, seq);
    if (cached?.result !== undefined) {
      return cached.result as T;
    }
    const result = compute();
    const effectData = {
      type: type as EffectType,
      seq,
      payload,
      executionId: frame.executionId,
      traceId: frame.ctx.traceId,
      threadId: frame.ctx.threadId,
      timestamp: Date.now(),
    };
    void resolver
      .resolve(effectData as Effect<EffectType>)
      .then(() => onEffectResolved(effectData))
      .catch(() => {});
    return result;
  };
}
