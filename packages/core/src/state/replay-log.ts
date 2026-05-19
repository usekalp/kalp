import type { EventStore } from "@/adapters/interfaces";
import type { ExecutionEvent } from "../engine/types";

/**
 * Cross-session safe error representation for deterministic replay.
 *
 * Preserves the error message, type name, and stack trace so that replay
 * can return the identical error shape without re-executing the failing effect.
 */
export interface SerializedError {
  message: string;
  name: string;
  stack?: string;
}

/**
 * An effect intent and its resolved output, retrieved from the EventStore.
 *
 * Carries the original sequence position so the replay engine can replay
 * effects in strict seq order without re-executing the underlying operation.
 */
export interface PersistedEffect {
  /** Position within the execution's sequence counter. Deterministic replay replays effects in strict seq order. */
  seq: number;
  /** The effect type string (e.g. "ai.generate", "storage.get"). */
  type: string;
  /** The handler invocation that produced this effect. */
  executionId: string;
  /** The trace this effect belongs to. */
  traceId: string;
  /** The actor that executed this effect. */
  threadId: string;
  /** When the effect was emitted. */
  timestamp: number;
  /** The input payload passed to the effect resolver. */
  payload: unknown;
  /** The successfully resolved output, if the effect completed without error. */
  result?: unknown;
  /** The serialized error, if the effect failed. Mutually exclusive with result. */
  error?: SerializedError;
}

/**
 * Deterministic replay cache that materialises persisted effects from the EventStore.
 *
 * Loads effect events into memory grouped by execution and indexed by sequence,
 * providing O(1) lookup so the replay engine can return cached results instead
 * of re-executing side-effectful operations.
 */
export class ReplayLog {
  /** Map from executionId to array of events indexed by sequence. */
  private eventsByExecution = new Map<string, PersistedEffect[]>();

  /**
   * Materialises effect events from the persistent EventStore into the replay cache.
   *
   * Filters by thread or trace when provided, sorts by sequence number, and
   * groups by executionId for O(1) lookup during replay.
   *
   * @param eventStore - The persistent event store to load from.
   * @param filters - Optional scope: load by threadId, traceId, or everything.
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
    const effectEvents = (events as PersistedEffect[]).filter(
      (e): e is PersistedEffect => (e as PersistedEffect).seq !== undefined,
    );

    // CRITICAL: Sort by seq to ensure deterministic ordering.
    effectEvents.sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));

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
   * Retrieves a previously-persisted effect by execution and sequence number.
   *
   * Returns `undefined` when the effect was never recorded, which signals the
   * replay engine to execute the effect live and record its result.
   *
   * @param executionId - The handler invocation that produced the effect.
   * @param seq - The sequence position within that execution.
   * @returns The persisted effect with its resolved result, or undefined if not yet recorded.
   */
  get(executionId: string, seq: number): PersistedEffect | undefined {
    const arr = this.eventsByExecution.get(executionId);
    return arr?.[seq];
  }

  /**
   * Records a newly-resolved effect into the in-memory cache.
   *
   * Called after the engine executes an effect that was not previously
   * persisted, making it available for subsequent lookups within the
   * same execution without re-execution.
   *
   * @param effect - The fully resolved effect to cache.
   */
  append(effect: PersistedEffect): void {
    if (!this.eventsByExecution.has(effect.executionId)) {
      this.eventsByExecution.set(effect.executionId, []);
    }
    const arr = this.eventsByExecution.get(effect.executionId)!;
    arr[effect.seq] = effect;
  }

  /**
   * Returns all persisted effects for a given execution, preserving sequence order.
   *
   * @param executionId - The handler invocation to query.
   * @returns The ordered array of effects, or undefined if none recorded.
   */
  getAll(executionId: string): PersistedEffect[] | undefined {
    return this.eventsByExecution.get(executionId);
  }

  /**
   * Empties the in-memory effect cache.
   *
   * Must be called between replays to reset state so the next replay
   * starts with a clean cache.
   */
  clear(): void {
    this.eventsByExecution.clear();
  }
}

/**
 * Normalises an unknown error value into a {@link SerializedError} for deterministic storage and replay.
 *
 * Preserves the message, name, and stack of `Error` instances; wraps
 * non-Error values with an "UnknownError" name so replay never receives
 * a raw thrown value that cannot be serialised.
 *
 * @param error - The thrown or rejected value to serialise.
 * @returns A serialised error structure safe for persistence.
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
