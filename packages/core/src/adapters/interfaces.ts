/**
 * Adapter interfaces for the Kalp v2 Orchestration Reactor.
 *
 * These contracts decouple the runtime core from any specific infrastructure.
 * The reactor never touches storage, scheduling, or transport directly —
 * it always goes through these interfaces.
 *
 * Implementations:
 * - {@link DurableObjectPersistence} / {@link DurableObjectScheduler} — Cloudflare DO
 * - {@link InMemoryPersistence} / {@link InMemoryScheduler} — local dev / tests
 *
 * @module
 */

import type { ExecutionEvent } from "../engine/types";

// ────────────────────────────────────────────────────────────────────────────
// Persistence
// ────────────────────────────────────────────────────────────────────────────

/**
 * Persistence adapter for execution events and agent state.
 *
 * Every operation that mutates state or logs events goes through this
 * interface. This enables the execution log to be the single source of
 * truth regardless of backing store (SQLite in DO, Map in memory, etc.).
 */
export interface PersistenceAdapter {
  /**
   * Appends a structured event to the execution log.
   * Events are append-only and ordered by insertion time.
   *
   * @param event - The execution event to persist.
   */
  appendEvent(event: ExecutionEvent): Promise<void>;

  /**
   * Loads all events from the execution log, ordered by insertion.
   * Used for replay, debugging, and rehydration.
   *
   * @returns An ordered array of all persisted execution events.
   */
  loadEvents(): Promise<ExecutionEvent[]>;

  /**
   * Reads a value from the agent's key-value state.
   *
   * @param key - The state key.
   * @returns The stored value, or `null` if not found.
   */
  getState(key: string): Promise<unknown>;

  /**
   * Writes a value to the agent's key-value state.
   *
   * @param key - The state key.
   * @param value - The value to store (must be JSON-serializable).
   */
  setState(key: string, value: unknown): Promise<void>;

  /**
   * Deletes a key from the agent's key-value state.
   *
   * @param key - The state key to delete.
   */
  deleteState(key: string): Promise<void>;
}

// ────────────────────────────────────────────────────────────────────────────
// Scheduling
// ────────────────────────────────────────────────────────────────────────────

/**
 * Scheduler adapter for deferred execution (alarms, timers).
 *
 * Used by `actions.wait` and `actions.loop` to schedule future wake-ups.
 * The adapter is responsible for persisting the alarm and re-entering
 * the reactor when it fires.
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
