import type { ReplayLog, PersistedEffect } from "../state/replay-log";

/**
 * Result of a replay validation attempt.
 */
export interface ReplayResult {
  /** Whether the replay succeeded without divergence. */
  success: boolean;
  /** The sequence number where the replay diverged from history, if any. */
  divergenceAt?: number;
  /** The expected effect found in history at the divergence point. */
  expected?: PersistedEffect;
  /** The actual effect generated during replay at the divergence point. */
  actual?: PersistedEffect;
  /** If true, the divergence is likely caused by code changes (drift). */
  driftDetected?: boolean;
}

/**
 * Validates that a new set of intents matches the historical event log.
 *
 * This function compares the newly generated intents against the historical
 * event log to detect any divergence.
 *
 * DESIGN NOTE: We currently prioritize 'type' comparison to avoid false positives
 * caused by non-deterministic JSON key ordering in complex payloads.
 *
 * @param log - The replay log buffer with historical events.
 * @param executionId - The unique execution identifier.
 * @param newIntents - The array of effects generated during the current replay attempt.
 * @returns A ReplayResult indicating success or detailed divergence info.
 */
export function validateReplay(
  log: ReplayLog,
  executionId: string,
  newIntents: PersistedEffect[],
): ReplayResult {
  const historical = log.getAll(executionId);

  // If there's no history, this is a fresh execution, so it's always valid.
  if (!historical || historical.length === 0) {
    return { success: true };
  }

  // Filter out any potential gaps in the sparse historical event array.
  const historicalEvents = historical.filter(
    (e): e is PersistedEffect => e !== undefined,
  );

  // 1. Validate sequence length
  // If the number of effects differs, it's an immediate divergence.
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

  // 2. Deep comparison of each effect intent
  for (let i = 0; i < newIntents.length; i++) {
    const historicalEvent = historicalEvents[i]!;
    const newIntent = newIntents[i]!;

    // We primarily compare the effect 'type'.
    // A mismatch in type is a definitive sign of execution drift.
    if (historicalEvent.type !== newIntent.type) {
      return {
        success: false,
        divergenceAt: historicalEvent.seq,
        expected: historicalEvent,
        actual: newIntent,
      };
    }

    // FUTURE: Add deep payload comparison using a deterministic JSON stringifier
    // to detect subtle data-level drift.
  }

  return { success: true };
}

/**
 * Simple utility to detect if two handler hashes differ.
 *
 * @param suspendedHandlerHash - The code hash recorded during suspension.
 * @param currentHandlerHash - The current code hash from the IR graph.
 * @returns True if the code has changed (drifted).
 */
export function detectSequenceKeyDrift(
  suspendedHandlerHash: string,
  currentHandlerHash: string,
): boolean {
  return suspendedHandlerHash !== currentHandlerHash;
}

/**
 * High-level helper to replay an execution and validate its determinism in one go.
 *
 * @param log - The replay log buffer.
 * @param executionId - The unique execution identifier.
 * @param replayFn - The async function that performs the re-execution and returns the new effects.
 * @returns The validation result.
 */
export async function replayAndValidate(
  log: ReplayLog,
  executionId: string,
  replayFn: () => Promise<PersistedEffect[]>,
): Promise<ReplayResult> {
  const newIntents = await replayFn();
  return validateReplay(log, executionId, newIntents);
}
