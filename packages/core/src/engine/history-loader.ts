import type { KalpHistoryMessage } from "@kalphq/sdk";
import type { ExecutionEvent } from "@/engine/types";
import type { PersistenceAdapter } from "@/adapters/interfaces";

/**
 * Loads conversation history for a thread from persisted execution events.
 * Filters for completed node and action-run events, mapping them to assistant history messages.
 *
 * @param threadId - The thread identifier to load history for.
 * @param persistence - The persistence adapter for event storage.
 * @returns An array of history messages from completed events, or an empty array on error.
 */
export async function loadHistory(
  threadId: string,
  persistence: PersistenceAdapter,
): Promise<KalpHistoryMessage[]> {
  if (!threadId) return [];

  try {
    const rawEvents = await persistence.events.loadByThread(threadId);
    return rawEvents
      .filter((e: ExecutionEvent) =>
        e.type === "node.completed" || e.type === "action.run.completed"
      )
      .map((e) => ({
        role: "assistant" as const,
        content: JSON.stringify({
          type: e.type,
          result: "result" in e ? e.result : undefined,
        }),
        timestamp: e.timestamp,
      }));
  } catch {
    return [];
  }
}
