/**
 * Replay engine for the Kalp Proxy-Listener Runtime.
 *
 * Validates that re-execution produces identical sequence of intents.
 * Detects Sequence Key Drift when handler code changes while suspended.
 *
 * CRITICAL: In V1, we do NOT compare full payloads to avoid false positives
 * due to non-deterministic JSON key ordering in JavaScript.
 *
 * @module
 */

import type { EventLogBuffer, IntentEvent } from "@/engine/event-log-buffer";

/**
 * Result of a replay validation.
 */
export interface ReplayResult {
  /** Whether the replay succeeded without divergence. */
  success: boolean;
  /** Sequence number where replay diverged, if any. */
  divergenceAt?: number;
  /** Expected event at divergence point. */
  expected?: IntentEvent;
  /** Actual event at divergence point. */
  actual?: IntentEvent;
  /** Handler hash mismatch indicates code drift. */
  driftDetected?: boolean;
}

/**
 * Validates that the replay produces the expected sequence of intents.
 *
 * This function compares the newly generated intents against the historical
 * event log to detect any divergence. In V1, we only compare event types,
 * not full payloads, to avoid false positives from non-deterministic JSON
 * key ordering.
 *
 * @param log - The event log buffer with historical events.
 * @param executionId - The execution identifier.
 * @param newIntents - Array of newly generated intents during replay.
 * @returns ReplayResult indicating success or divergence details.
 */
export function validateReplay(
  log: EventLogBuffer,
  executionId: string,
  newIntents: IntentEvent[],
): ReplayResult {
  const historical = log.getAll(executionId);

  // No history means fresh execution - always valid
  if (!historical || historical.length === 0) {
    return { success: true };
  }

  // Get non-null historical events (sparse array)
  const historicalEvents = historical.filter(
    (e): e is IntentEvent => e !== undefined,
  );

  // Check sequence count match
  if (newIntents.length !== historicalEvents.length) {
    const divergenceAt = Math.min(newIntents.length, historicalEvents.length);
    const expected = historicalEvents[divergenceAt];
    const actual = newIntents[divergenceAt - 1];
    return {
      success: false,
      divergenceAt,
      expected,
      actual,
      driftDetected: newIntents.length > historicalEvents.length,
    };
  }

  // Compare each intent
  for (let i = 0; i < newIntents.length; i++) {
    const historicalEvent = historicalEvents[i];
    const newIntent = newIntents[i];

    // Skip if either event is undefined
    if (!historicalEvent || !newIntent) continue;

    // Skip if historical event has no seq (shouldn't happen)
    if (historicalEvent.seq === undefined) continue;

    // V1: Only compare types, NOT full payloads
    // This avoids false positives from JSON key ordering
    const historicalType = historicalEvent.type;
    const newType = newIntent.type;

    if (historicalType !== newType) {
      return {
        success: false,
        divergenceAt: historicalEvent.seq,
        expected: historicalEvent,
        actual: newIntent,
      };
    }

    // V2+ (future): Add payload comparison with deterministic stringify
    // For now, type mismatch is sufficient to detect drift
  }

  return { success: true };
}

/**
 * Detects if handler code has changed during suspension.
 *
 * Compares the handler hash stored in suspension state with the current
 * handler hash. If they differ, the code has drifted.
 *
 * @param suspendedHandlerHash - Hash stored in suspension state.
 * @param currentHandlerHash - Current handler hash from IR.
 * @returns True if drift is detected.
 */
export function detectSequenceKeyDrift(
  suspendedHandlerHash: string,
  currentHandlerHash: string,
): boolean {
  return suspendedHandlerHash !== currentHandlerHash;
}

/**
 * Replays an execution and validates determinism.
 *
 * This is the main entry point for replay validation. It executes
 * the handler with the event log buffer and validates the result.
 *
 * @param log - The event log buffer.
 * @param executionId - The execution identifier.
 * @param replayFn - Function that performs the replay and returns new intents.
 * @returns ReplayResult indicating success or divergence.
 */
export async function replayAndValidate(
  log: EventLogBuffer,
  executionId: string,
  replayFn: () => Promise<IntentEvent[]>,
): Promise<ReplayResult> {
  // Execute replay
  const newIntents = await replayFn();

  // Validate
  return validateReplay(log, executionId, newIntents);
}
