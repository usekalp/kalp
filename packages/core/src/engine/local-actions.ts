import type { IRGraph, KalpHistoryMessage } from "@kalphq/sdk";
import type { RuntimeEvent } from "@/engine/types";
import type { PersistenceAdapter } from "@/adapters/interfaces";
import type { ListenerRef, LocalActions } from "@/effects/primitives";
import type { ExecutionFrame } from "../execution/frame";
import type { ReplayLog } from "../state/replay-log";
import type { EffectResolver } from "@/effects/types";
import type { RuntimeBundleLoader, ExecutionResult } from "./handler-executor";
import type { BundleManifest } from "@kalphq/sdk";
import { resolveListenerNodeId } from "./event-router";
import { executeHandlerBundle } from "./handler-executor";

/**
 * Creates a LocalActions object bound to the current execution frame.
 *
 * The `call` method invokes a listener synchronously within the same execution.
 * The `dispatch` method enqueues a listener event for asynchronous processing via the event log.
 *
 * @param frame - The current execution frame.
 * @param ir - The agent's IR graph.
 * @param persistence - The persistence adapter for event storage.
 * @param log - The replay log for effect tracking.
 * @param resolver - The effect resolver.
 * @param _schemas - The schema registry.
 * @param bundleManifest - The bundle manifest for handler resolution.
 * @param bundleLoader - The bundle loader for handler code.
 * @param state - The current agent state.
 * @param historyMessages - The agent's conversation history messages.
 * @returns A LocalActions instance with call and dispatch methods.
 */
export function createLocalActions(
  frame: ExecutionFrame,
  ir: IRGraph,
  persistence: PersistenceAdapter,
  log: ReplayLog,
  resolver: EffectResolver,
  _schemas: Record<string, unknown>,
  bundleManifest: BundleManifest,
  bundleLoader: RuntimeBundleLoader,
  state: Record<string, unknown>,
  historyMessages: KalpHistoryMessage[],
): LocalActions {
  return {
    call: async (listener: ListenerRef, payload: unknown) => {
      const listenerNodeId = resolveListenerNodeId(listener, ir);
      if (!listenerNodeId) {
        throw new Error(
          `No local listener found for ${listener?.__runtimeId ?? listener?.event ?? "unknown"}`,
        );
      }

      const listenerEvent: RuntimeEvent = {
        type: `listener:${listener?.event ?? "unknown"}`,
        payload,
        threadId: frame.ctx.threadId,
        traceId: frame.ctx.traceId,
      };

      const result: ExecutionResult = await executeHandlerBundle(
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
        historyMessages,
      );

      return result.value;
    },
    dispatch: async (listener: ListenerRef, payload: unknown) => {
      const listenerNodeId = resolveListenerNodeId(listener, ir);
      if (!listenerNodeId) {
        throw new Error(
          `No local listener found for ${listener?.__runtimeId ?? listener?.event ?? "unknown"}`,
        );
      }

      const eventId = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      await persistence.events.append({
        type: "listener.queued",
        listenerEntryKey: listenerNodeId,
        payload,
        executionId: frame.executionId,
        traceId: frame.ctx.traceId,
        threadId: frame.ctx.threadId,
        timestamp: Date.now(),
      });

      return { eventId };
    },
  };
}
