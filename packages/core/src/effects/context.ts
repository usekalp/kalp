import type {
  KalpContext,
  KalpAuth,
  AgentDefinition,
  KalpHistory,
} from "@kalphq/sdk";
import type { EffectResolver } from "./types";
import type { ReplayLog, PersistedEffect } from "../state/replay-log";
import type { ExecutionFrame } from "../execution/frame";

import {
  createAIContext,
  createCacheContext,
  createMathContext,
  createTimeContext,
  createMemoryContext,
  createMcpContext,
  createLogContext,
  createVaultContext,
  createActionsContext,
  createRuntimeContext,
  createSchedulesContext,
  type LocalActions,
} from "./primitives";
import {
  createInterceptEffect,
  createInterceptLocalEffect,
  createInterceptSync,
} from "./interceptors";

/**
 * Create the full agent execution context by wiring all primitives to the effect resolution pipeline.
 * Assembles AI, cache, time, memory, MCP, log, vault, actions, schedules, and runtime into a single
 * {@link KalpContext} used throughout agent execution.
 *
 * @param resolver - Effect resolver that processes each effect.
 * @param log - Replay log for deterministic replay of effect sequences.
 * @param frame - Current execution frame containing sequencing and tracing state.
 * @param onEffectResolved - Callback invoked after each effect is persisted.
 * @param agentDefinition - Agent metadata including name and configuration.
 * @param history - Conversation history for the current execution.
 * @param state - Agent-level state bag shared across primitives.
 * @param localActions - Local action handlers for call and dispatch within the same process.
 * @param auth - Optional authentication context for the current user.
 */
export function createProxyContext(
  resolver: EffectResolver,
  log: ReplayLog,
  frame: ExecutionFrame,
  onEffectResolved: (effect: PersistedEffect) => Promise<void>,
  agentDefinition: AgentDefinition,
  history: KalpHistory,
  state: Record<string, unknown>,
  localActions: LocalActions,
  auth?: KalpAuth,
): KalpContext {
  const interceptEffect = createInterceptEffect(resolver, log, frame, onEffectResolved);
  const interceptLocalEffect = createInterceptLocalEffect(resolver, log, frame, onEffectResolved);
  const interceptSync = createInterceptSync(resolver, log, frame, onEffectResolved);

  const baseTime = interceptSync("time.baseTime", {}, () => Date.now());

  return {
    ai: createAIContext(interceptEffect),
    cache: createCacheContext(interceptEffect),
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
    auth: auth ?? { userId: null, email: null, name: null, claims: null, isAuthenticated: false, getToken: () => null },
  } as unknown as KalpContext;
}
