/**
 * Adapter interfaces for the Kalp Orchestration Reactor.
 *
 * These contracts decouple the runtime core from any specific infrastructure.
 * The reactor never touches storage, scheduling, or transport directly —
 * it always goes through these interfaces.
 *
 * Implementations:
 * - Cloudflare DO adapter (DurableObjectStorage, Alarms, fetch)
 * - InMemory adapter (Maps, timeouts) — local dev / tests
 *
 * @module
 */

import type { ExecutionEvent } from "../engine/types";
import type { PersistedEffect } from "../state/replay-log";

// ────────────────────────────────────────────────────────────────────────────
// Sub-stores (decomposed persistence)
// ────────────────────────────────────────────────────────────────────────────

/**
 * KV-like state store for agent runtime data.
 *
 * Supports get/set/delete and atomic transactions. Co-located with the
 * actor — adapters decide backing store (DO storage, Redis, in-memory).
 */
export interface StateStore {
  /**
   * Reads a value from state.
   *
   * @param key - The state key.
   * @returns The stored value, or `null` if not found.
   */
  get(key: string): Promise<unknown>;

  /**
   * Writes a value to state.
   *
   * @param key - The state key.
   * @param value - The value to store (must be JSON-serializable).
   */
  set(key: string, value: unknown): Promise<void>;

  /**
   * Deletes a key from state.
   *
   * @param key - The state key to delete.
   */
  delete(key: string): Promise<void>;

  /**
   * Atomically increments a numeric value.
   *
   * @param key - The key to increment.
   * @param amount - The amount to add.
   * @returns The new value.
   */
  increment(key: string, amount: number): Promise<number>;

  /**
   * Lists keys with an optional prefix.
   *
   * @param prefix - Optional prefix to filter keys.
   * @returns An array of matching keys.
   */
  list(prefix?: string): Promise<string[]>;

  /**
   * Executes a batch of atomic operations.
   *
   * @param operations - The operations to perform atomically.
   */
  batch(operations: Array<
    | { op: "put"; key: string; value: unknown }
    | { op: "delete"; key: string }
    | { op: "increment"; key: string; amount: number }
    | { op: "cas"; key: string; expected: unknown; next: unknown }
  >): Promise<void>;
}

/**
 * Append-only execution event log.
 *
 * All structured events flow through this store. It is the system's source
 * of truth for replay, debugging, and observability.
 */
export interface EventStore {
  /**
   * Appends a structured event to the execution log.
   * Events are append-only and ordered by insertion time.
   *
   * @param event - The execution event to persist.
   */
  append(event: ExecutionEvent | PersistedEffect): Promise<void>;

  /**
   * Loads all events from the execution log, ordered by insertion.
   * Used for replay, debugging, and rehydration.
   *
   * @returns An ordered array of all persisted execution events.
   */
  loadAll(): Promise<ExecutionEvent[]>;

  /**
   * Loads events filtered by thread ID.
   *
   * @param threadId - The thread to filter by.
   * @returns Events belonging to the specified thread.
   */
  loadByThread(threadId: string): Promise<ExecutionEvent[]>;

  /**
   * Loads events filtered by trace ID.
   *
   * @param traceId - The trace to filter by.
   * @returns Events belonging to the specified trace.
   */
  loadByTrace(traceId: string): Promise<ExecutionEvent[]>;
}

/**
 * KV store with TTL for idempotency deduplication.
 *
 * Actor-scoped (not global). Stored via the adapter's backing store.
 * Zero race conditions since the actor is single-threaded.
 */
export interface IdempotencyStore {
  /**
   * Retrieves a cached result by idempotency key.
   *
   * @param key - The composite idempotency key.
   * @returns The cached result, or `null` if not found or expired.
   */
  get(key: string): Promise<unknown | null>;

  /**
   * Stores a result with an optional TTL.
   *
   * @param key - The composite idempotency key.
   * @param result - The result to cache.
   * @param opts - Optional settings (TTL in milliseconds).
   */
  set(key: string, result: unknown, opts?: { ttlMs?: number }): Promise<void>;
}

/**
 * Thread metadata store.
 *
 * Stores and retrieves metadata associated with a thread (actor instance).
 */
export interface ThreadStore {
  /**
   * Retrieves metadata for a thread.
   *
   * @param threadId - The thread identifier.
   * @returns The thread metadata, or `null` if not set.
   */
  getMeta(threadId: string): Promise<Record<string, unknown> | null>;

  /**
   * Stores metadata for a thread.
   *
   * @param threadId - The thread identifier.
   * @param meta - The metadata to store.
   */
  setMeta(threadId: string, meta: Record<string, unknown>): Promise<void>;
}

// ────────────────────────────────────────────────────────────────────────────
// Persistence (composite adapter)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Composite persistence adapter decomposed into specialized sub-stores.
 *
 * This prevents a single monolithic adapter from hiding 4 different
 * storage patterns behind one interface. Each sub-store has clear semantics.
 */
export interface PersistenceAdapter {
  /** KV-like state store (get/set/delete/transaction). */
  state: StateStore;
  /** Append-only execution event log. */
  events: EventStore;
  /** KV with TTL for idempotency deduplication. */
  idempotency: IdempotencyStore;
  /** Thread metadata store. */
  threads: ThreadStore;
}

// ────────────────────────────────────────────────────────────────────────────
// Scheduling
// ────────────────────────────────────────────────────────────────────────────

/**
 * Alarm payload for resuming suspended execution.
 */
export interface AlarmPayload {
  executionId: string;
  traceId: string;
  wakeReason: string;
  scheduleId?: string;
  threadId?: string;
}

/**
 * Scheduler adapter for deferred execution (alarms, timers).
 *
 * Supports multiple concurrent schedules. The Core manages the logical
 * schedule queue in StateStore; the adapter only sets the physical timer
 * for the next due alarm.
 *
 * **Best-effort timing** — scheduled events are approximate, not guaranteed
 * to fire at the exact requested time.
 */
export interface SchedulerAdapter {
  /**
   * Schedules a wake-up at the given timestamp.
   * Replaces any existing alarm (adapter tracks only one physical timer).
   *
   * @param at - Unix timestamp in milliseconds.
   * @param payload - Data to pass when resuming.
   */
  scheduleAlarm(at: number, payload: AlarmPayload): Promise<void>;

  /**
   * Cancels any pending scheduled wake-up.
   */
  cancelAlarm(): Promise<void>;

  /**
   * Called by the host when an alarm fires.
   * Returns due alarms up to current time.
   *
   * @returns Array of due alarm payloads.
   */
  popDueAlarms(): Promise<AlarmPayload[]>;
}

// ────────────────────────────────────────────────────────────────────────────
// Transport
// ────────────────────────────────────────────────────────────────────────────

/**
 * Transport adapter for sending responses back to the caller.
 *
 * Used when the reactor needs to push data to a connected client
 * (e.g. WebSocket message, streaming response).
 */
export interface TransportAdapter {
  /**
   * Sends a response payload to the connected client.
   *
   * @param response - The data to send (will be JSON-serialized).
   */
  send(response: unknown): Promise<void>;
}

// ────────────────────────────────────────────────────────────────────────────
// Cross-thread messaging
// ────────────────────────────────────────────────────────────────────────────

/**
 * Adapter for cross-thread (cross-actor) messaging.
 *
 * Core never uses HTTP semantics directly. The adapter maps to the
 * appropriate transport (CF: fetch to DO, Node: IPC, tests: direct call).
 */
export interface CrossThreadAdapter {
  /**
   * Sends an event to another thread (actor).
   *
   * @param targetThreadId - The target thread's opaque identifier.
   * @param event - The event name.
   * @param payload - The event payload.
   */
  send(targetThreadId: string, event: string, payload: unknown): Promise<void>;

  /**
   * Calls an agent via its contract and awaits response.
   * Used by ctx.actions.callAgent.
   *
   * @param targetThreadId - The target thread's opaque identifier.
   * @param contract - The agent contract defining the RPC interface.
   * @param input - The input payload for the contract.
   * @returns The output from the target agent.
   */
  callAgent<TInput, TOutput>(
    targetThreadId: string,
    contract: { name: string; input?: unknown; output?: unknown },
    input: TInput,
  ): Promise<TOutput>;
}
