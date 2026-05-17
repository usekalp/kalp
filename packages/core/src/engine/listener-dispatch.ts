/**
 * Listener dispatch effect persistence.
 *
 * @module
 */

import type { PersistenceAdapter } from "@/adapters/interfaces";
import type { PersistedEffect } from "../state/replay-log";
import type { IRGraph } from "@kalphq/sdk";

export async function handleEffect(
  effect: PersistedEffect,
  persistence: PersistenceAdapter,
  _ir: IRGraph,
): Promise<void> {
  await persistence.events.append(effect);
}
