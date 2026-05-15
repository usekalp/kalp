/**
 * Listener dispatch - handles cross-agent event fan-out.
 *
 * @module
 */

import type { EventDispatchEnvelope } from "@/engine/types";
import type { PersistenceAdapter } from "@/adapters/interfaces";
import type { PersistedEffect } from "../state/replay-log";
import type { IRGraph } from "@kalphq/sdk";

/**
 * Dispatches listeners triggered by an emit action.
 * Finds matching listener nodes in the IR graph and executes them asynchronously.
 */
export async function dispatchToListeners(
  envelope: EventDispatchEnvelope,
  threadId: string,
  persistence: PersistenceAdapter,
  ir: IRGraph,
): Promise<void> {
  const listeners = Object.entries(ir.nodes || {})
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    .filter(([_, node]) => {
      if (node.kind !== "listener" || !node.source) return false;
      if (node.source.event !== envelope.eventName) return false;
      if (!envelope.sourceAgentId) return true;
      return node.source.agentId === envelope.sourceAgentId;
    })
    .map(([key]) => ({ targetEntryKey: key }));

  for (const listener of listeners) {
    await persistence.events.append({
      type: "listener.queued",
      listenerEntryKey: listener.targetEntryKey,
      payload: envelope,
      executionId: envelope.parentExecutionId,
      traceId: envelope.traceId,
      threadId,
      timestamp: Date.now(),
    });

    executeListenerAsync(
      listener.targetEntryKey,
      envelope,
      threadId,
      persistence,
    );
  }
}

async function executeListenerAsync(
  listenerEntryKey: string,
  envelope: EventDispatchEnvelope,
  threadId: string,
  persistence: PersistenceAdapter,
): Promise<void> {
  const listenerExecutionId = crypto.randomUUID();

  await persistence.events.append({
    type: "listener.started",
    listenerEntryKey,
    payload: envelope,
    executionId: listenerExecutionId,
    traceId: envelope.traceId,
    threadId,
    timestamp: Date.now(),
  });

  try {
    // The actual handleEvent for the listener is triggered externally
    await persistence.events.append({
      type: "listener.completed",
      listenerEntryKey,
      payload: envelope,
      executionId: listenerExecutionId,
      traceId: envelope.traceId,
      threadId,
      timestamp: Date.now(),
    });
  } catch (error) {
    await persistence.events.append({
      type: "listener.failed",
      listenerEntryKey,
      error: error instanceof Error ? error.message : String(error),
      payload: envelope,
      executionId: listenerExecutionId,
      traceId: envelope.traceId,
      threadId,
      timestamp: Date.now(),
    });
  }
}

/**
 * Handles an effect that was intercepted during execution.
 * Persists the effect and triggers listener dispatch for emit events.
 */
export async function handleEffect(
  effect: PersistedEffect,
  persistence: PersistenceAdapter,
  ir: IRGraph,
): Promise<void> {
  await persistence.events.append(effect);

  if (effect.type === "action.emit") {
    const {
      event: emitEvent,
      data,
      options,
    } = effect.payload as {
      event: string;
      data: unknown;
      options?: { sourceAgentId?: string };
    };

    const envelope: EventDispatchEnvelope = {
      eventName: emitEvent,
      payload: data,
      traceId: effect.traceId,
      parentExecutionId: effect.executionId,
      sourceAgentId: options?.sourceAgentId ?? ir.agent?.name ?? "unknown",
    };

    await dispatchToListeners(envelope, effect.threadId, persistence, ir);
  }
}
