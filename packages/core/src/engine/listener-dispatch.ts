/**
 * Listener dispatch effect persistence.
 *
 * @module
 */

import type { PersistenceAdapter } from "@/adapters/interfaces";
import type { PersistedEffect } from "../state/replay-log";
import type { IRGraph } from "@kalphq/sdk";

/**
 * Persists an effect to the event store via the persistence adapter.
 *
 * @param effect - The effect to persist.
 * @param persistence - The persistence adapter for event storage.
 */
export async function handleEffect(
  effect: PersistedEffect,
  persistence: PersistenceAdapter,
  _ir: IRGraph,
): Promise<void> {
  await persistence.events.append(effect);
}
