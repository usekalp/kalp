import type { EventStore } from "@/adapters/interfaces";
import type { ExecutionEvent } from "../engine/types";

/**
 * Serialized error for deterministic replay.
 */
export interface SerializedError {
  message: string;
  name: string;
  stack?: string;
}

/**
 * A persisted effect intent with its resolution.
 * Loaded from the EventStore for the ReplayLog.
 */
export interface PersistedEffect {
  seq: number;
  type: string;
  executionId: string;
  traceId: string;
  threadId: string;
  timestamp: number;
  payload: unknown;
  result?: unknown;
  error?: SerializedError;
}

/**
 * In-memory buffer for fast event lookup during execution.
 *
 * Loads events from the EventStore and provides O(1) lookup by sequence.
 */
export class ReplayLog {
  /** Map from executionId to array of events indexed by sequence. */
  private eventsByExecution = new Map<string, PersistedEffect[]>();

  /**
   * Loads events from the EventStore into memory.
   *
   * @param eventStore - The persistent event store.
   * @param filters - Optional filters for loading specific events.
   */
  async loadFromSQLite(
    eventStore: EventStore,
    filters?: { threadId?: string; traceId?: string },
  ): Promise<void> {
    let events: ExecutionEvent[];

    if (filters?.threadId) {
      events = await eventStore.loadByThread(filters.threadId);
    } else if (filters?.traceId) {
      events = await eventStore.loadByTrace(filters.traceId);
    } else {
      events = await eventStore.loadAll();
    }

    // Filter only effect-related events (those with a sequence number)
    // In our architecture, effects have `seq` assigned.
    const effectEvents = events.filter((e): e is PersistedEffect => (e as any).seq !== undefined);

    // CRITICAL: Sort by seq to ensure deterministic ordering.
    effectEvents.sort((a, b) => a.seq - b.seq);

    // Group by executionId
    for (const event of effectEvents) {
      if (!this.eventsByExecution.has(event.executionId)) {
        this.eventsByExecution.set(event.executionId, []);
      }
      const arr = this.eventsByExecution.get(event.executionId)!;
      arr[event.seq] = event;
    }
  }

  /**
   * Gets a cached effect resolution by executionId and sequence number.
   *
   * @param executionId - The execution identifier.
   * @param seq - The sequence number.
   * @returns The resolved effect result, or undefined if not completed.
   */
  get(executionId: string, seq: number): PersistedEffect | undefined {
    const arr = this.eventsByExecution.get(executionId);
    return arr?.[seq];
  }

  /**
   * Appends a new effect resolution to the buffer dynamically.
   */
  append(effect: PersistedEffect): void {
    if (!this.eventsByExecution.has(effect.executionId)) {
      this.eventsByExecution.set(effect.executionId, []);
    }
    const arr = this.eventsByExecution.get(effect.executionId)!;
    arr[effect.seq] = effect;
  }

  getAll(executionId: string): PersistedEffect[] | undefined {
    return this.eventsByExecution.get(executionId);
  }

  clear(): void {
    this.eventsByExecution.clear();
  }
}

export function serializeError(error: unknown): SerializedError {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
    };
  }
  return {
    message: String(error),
    name: "UnknownError",
  };
}
