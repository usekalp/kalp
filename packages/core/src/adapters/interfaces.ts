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
import type { IntentEvent } from "../engine/event-log-buffer";

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
   * Executes a function within an atomic transaction.
   *
   * @param fn - The transactional function receiving a scoped store.
   * @returns The transaction's return value.
   */
  transaction<T>(fn: (tx: StateStore) => Promise<T>): Promise<T>;
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
  append(event: ExecutionEvent | IntentEvent): Promise<void>;

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
 * Scheduler adapter for deferred execution (alarms, timers).
 *
 * Used by `actions.wait`, `actions.loop`, and `actions.schedule` for future
 * wake-ups. The adapter is responsible for persisting the alarm and re-entering
 * the reactor when it fires.
 *
 * Adapters may have limitations (e.g. CF: 1 alarm per DO). Core handles
 * multi-schedule queuing in {@link StateStore}; adapter fires one at a time.
 *
 * **Best-effort timing** — scheduled events are approximate, not guaranteed
 * to fire at the exact requested time.
 */
export interface SchedulerAdapter {
  /**
   * Schedules a wake-up at the given timestamp (ms since epoch).
   * If an alarm already exists, it should be replaced.
   *
   * @param at - Unix timestamp in milliseconds for the wake-up.
   */
  schedule(at: number): Promise<void>;

  /**
   * Cancels any pending scheduled wake-up.
   */
  cancel(): Promise<void>;

  /**
   * Schedules an alarm with payload for resuming suspended execution.
   * Used by actions.waitUntil for durable execution.
   *
   * @param at - Unix timestamp in milliseconds for the wake-up.
   * @param payload - Data to pass when resuming (executionId, traceId, etc.).
   */
  scheduleAlarm(
    at: number,
    payload: { executionId: string; traceId: string; wakeReason: string },
  ): Promise<void>;
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
}
