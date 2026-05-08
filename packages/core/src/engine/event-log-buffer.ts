/**
 * EventLogBuffer for deterministic execution replay.
 *
 * Provides fast in-memory O(1) lookup of events by sequence number.
 * Used by the proxy runtime to check for cached results before executing.
 *
 * @module
 */

import type { EventStore } from "@/adapters/interfaces";

/**
 * A persisted intent event with optional result or error.
 */
export interface IntentEvent {
  /** Sequence number - assigned synchronously at call time for determinism. */
  seq: number;
  /** Event type (e.g., "intent.run_step", "intent.ai_generate"). */
  type: string;
  /** Execution identifier (this handler invocation). */
  executionId: string;
  /** Trace identifier (this handleEvent call). */
  traceId: string;
  /** Thread identifier (DO instance). */
  threadId: string;
  /** Timestamp of the event. */
  timestamp: number;
  /** Input payload for the intent. */
  payload: unknown;
  /** Cached result (if execution completed). */
  result?: unknown;
  /** Serialized error (if execution failed). */
  error?: SerializedError;
  /** Status for long-running intents (e.g., "waiting" for HITL). */
  status?: string;
}

/**
 * Serialized error for deterministic replay.
 */
export interface SerializedError {
  message: string;
  name: string;
  stack?: string;
}

/**
 * In-memory buffer for fast event lookup during execution.
 *
 * Loads events from the EventStore and provides O(1) lookup by sequence.
 */
export class EventLogBuffer {
  /** Map from executionId to array of events indexed by sequence. */
  private eventsByExecution = new Map<string, IntentEvent[]>();

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
    let events: IntentEvent[];

    if (filters?.threadId) {
      events = (await eventStore.loadByThread(filters.threadId)) as IntentEvent[];
    } else if (filters?.traceId) {
      events = (await eventStore.loadByTrace(filters.traceId)) as IntentEvent[];
    } else {
      events = (await eventStore.loadAll()) as IntentEvent[];
    }

    // Group by executionId and sort by seq
    for (const event of events) {
      if (!this.eventsByExecution.has(event.executionId)) {
        this.eventsByExecution.set(event.executionId, []);
      }
      const arr = this.eventsByExecution.get(event.executionId)!;
      arr[event.seq] = event;
    }
  }

  /**
   * Gets an event by executionId and sequence number.
   *
   * @param executionId - The execution identifier.
   * @param seq - The sequence number.
   * @returns The event, or undefined if not found.
   */
  get(executionId: string, seq: number): IntentEvent | undefined {
    const arr = this.eventsByExecution.get(executionId);
    return arr?.[seq];
  }

  /**
   * Appends a new event to the buffer.
   *
   * @param event - The event to append.
   */
  append(event: IntentEvent): void {
    if (!this.eventsByExecution.has(event.executionId)) {
      this.eventsByExecution.set(event.executionId, []);
    }
    const arr = this.eventsByExecution.get(event.executionId)!;
    arr[event.seq] = event;
  }

  /**
   * Gets all events for an execution.
   *
   * @param executionId - The execution identifier.
   * @returns Array of events, sparse array (may have gaps).
   */
  getAll(executionId: string): IntentEvent[] | undefined {
    return this.eventsByExecution.get(executionId);
  }

  /**
   * Clears the buffer.
   */
  clear(): void {
    this.eventsByExecution.clear();
  }
}

/**
 * Serializes an Error for persistence and replay.
 *
 * @param error - The error to serialize.
 * @returns Serialized error object.
 */
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

/**
 * Deserializes a SerializedError back into an Error instance.
 *
 * @param serialized - The serialized error.
 * @returns Error instance.
 */
export function deserializeError(serialized: SerializedError): Error {
  const error = new Error(serialized.message);
  error.name = serialized.name;
  if (serialized.stack) {
    error.stack = serialized.stack;
  }
  return error;
}
