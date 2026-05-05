/**
 * In-memory adapter implementations for local dev and testing.
 *
 * These adapters store everything in memory — no persistence, no real alarms.
 * Ideal for unit tests, local dev, and integration testing without infrastructure.
 *
 * HARD RULES (R4 — test-utils boundaries):
 * - Deterministic fakes only (no randomness)
 * - No real timing (setTimeout, setInterval, real delays)
 * - No DurableObject behavior emulation (alarm queuing, hibernation, eviction)
 * - No cross-thread transport logic (HTTP routing, fetch)
 * - No event ordering guarantees beyond insertion order
 * - No retry/backoff logic
 * - No Cloudflare-specific types or imports
 *
 * @module
 */

import type {
  PersistenceAdapter,
  SchedulerAdapter,
  TransportAdapter,
  CrossThreadAdapter,
  StateStore,
  EventStore,
  IdempotencyStore,
  ThreadStore,
  ExecutionEvent,
} from "@kalphq/core";

// ────────────────────────────────────────────────────────────────────────────
// In-Memory Sub-stores
// ────────────────────────────────────────────────────────────────────────────

/**
 * In-memory state store. KV backed by a Map.
 */
export class InMemoryStateStore implements StateStore {
  private data = new Map<string, unknown>();

  /** @inheritdoc */
  async get(key: string): Promise<unknown> {
    return this.data.get(key) ?? null;
  }

  /** @inheritdoc */
  async set(key: string, value: unknown): Promise<void> {
    this.data.set(key, value);
  }

  /** @inheritdoc */
  async delete(key: string): Promise<void> {
    this.data.delete(key);
  }

  /** @inheritdoc */
  async increment(key: string, amount: number): Promise<number> {
    const current = (this.data.get(key) as number) ?? 0;
    const next = current + amount;
    this.data.set(key, next);
    return next;
  }

  /** @inheritdoc */
  async transaction<T>(fn: (tx: StateStore) => Promise<T>): Promise<T> {
    // In-memory: no real transaction isolation, just execute inline.
    return fn(this);
  }

  /** Returns all state entries (for test assertions). */
  getSnapshot(): ReadonlyMap<string, unknown> {
    return this.data;
  }

  /** Resets all data. */
  reset(): void {
    this.data.clear();
  }
}

/**
 * In-memory event store. Append-only array.
 */
export class InMemoryEventStore implements EventStore {
  private events: ExecutionEvent[] = [];

  /** @inheritdoc */
  async append(event: ExecutionEvent): Promise<void> {
    this.events.push(event);
  }

  /** @inheritdoc */
  async loadAll(): Promise<ExecutionEvent[]> {
    return [...this.events];
  }

  /** @inheritdoc */
  async loadByThread(threadId: string): Promise<ExecutionEvent[]> {
    return this.events.filter(
      (e) => "threadId" in e && e.threadId === threadId,
    );
  }

  /** @inheritdoc */
  async loadByTrace(traceId: string): Promise<ExecutionEvent[]> {
    return this.events.filter((e) => "traceId" in e && e.traceId === traceId);
  }

  /** Returns all persisted events (for test assertions). */
  getEvents(): ReadonlyArray<ExecutionEvent> {
    return this.events;
  }

  /** Resets all data. */
  reset(): void {
    this.events = [];
  }
}

/**
 * In-memory idempotency store. KV with expiration check on read.
 */
export class InMemoryIdempotencyStore implements IdempotencyStore {
  private data = new Map<string, { result: unknown; expiresAt?: number }>();

  /** @inheritdoc */
  async get(key: string): Promise<unknown | null> {
    const entry = this.data.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.data.delete(key);
      return null;
    }
    return entry.result;
  }

  /** @inheritdoc */
  async set(
    key: string,
    result: unknown,
    opts?: { ttlMs?: number },
  ): Promise<void> {
    this.data.set(key, {
      result,
      expiresAt: opts?.ttlMs ? Date.now() + opts.ttlMs : undefined,
    });
  }

  /** Resets all data. */
  reset(): void {
    this.data.clear();
  }
}

/**
 * In-memory thread store. Metadata backed by a Map.
 */
export class InMemoryThreadStore implements ThreadStore {
  private meta = new Map<string, Record<string, unknown>>();

  /** @inheritdoc */
  async getMeta(threadId: string): Promise<Record<string, unknown> | null> {
    return this.meta.get(threadId) ?? null;
  }

  /** @inheritdoc */
  async setMeta(
    threadId: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    this.meta.set(threadId, metadata);
  }

  /** Resets all data. */
  reset(): void {
    this.meta.clear();
  }
}

// ────────────────────────────────────────────────────────────────────────────
// In-Memory Persistence (composite)
// ────────────────────────────────────────────────────────────────────────────

/**
 * In-memory composite persistence adapter.
 *
 * Composes the 4 sub-stores. Nothing survives process restart.
 * Used in tests and local development.
 */
export class InMemoryPersistence implements PersistenceAdapter {
  /** @inheritdoc */
  readonly state: InMemoryStateStore;
  /** @inheritdoc */
  readonly events: InMemoryEventStore;
  /** @inheritdoc */
  readonly idempotency: InMemoryIdempotencyStore;
  /** @inheritdoc */
  readonly threads: InMemoryThreadStore;

  constructor() {
    this.state = new InMemoryStateStore();
    this.events = new InMemoryEventStore();
    this.idempotency = new InMemoryIdempotencyStore();
    this.threads = new InMemoryThreadStore();
  }

  /** Resets all sub-stores. */
  reset(): void {
    this.state.reset();
    this.events.reset();
    this.idempotency.reset();
    this.threads.reset();
  }
}

// ────────────────────────────────────────────────────────────────────────────
// In-Memory Scheduler
// ────────────────────────────────────────────────────────────────────────────

/**
 * In-memory scheduler adapter.
 *
 * Instead of setting real alarms, it stores the scheduled timestamp.
 * The test harness can inspect and manually fire scheduled wake-ups.
 */
export class InMemoryScheduler implements SchedulerAdapter {
  /** The next scheduled wake-up timestamp, or null. */
  private scheduledAt: number | null = null;
  /** Optional callback when a schedule fires (for test harness). */
  private onFire?: () => Promise<void>;

  /**
   * @param onFire - Optional callback invoked when the scheduled alarm fires.
   */
  constructor(onFire?: () => Promise<void>) {
    this.onFire = onFire;
  }

  /** @inheritdoc */
  async schedule(at: number): Promise<void> {
    this.scheduledAt = at;
  }

  /** @inheritdoc */
  async cancel(): Promise<void> {
    this.scheduledAt = null;
  }

  // ── Test helpers ──

  /** Returns the next scheduled timestamp, or null. */
  getScheduledAt(): number | null {
    return this.scheduledAt;
  }

  /** Simulates the alarm firing. Clears the schedule and calls onFire. */
  async fire(): Promise<void> {
    this.scheduledAt = null;
    if (this.onFire) {
      await this.onFire();
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// In-Memory Transport
// ────────────────────────────────────────────────────────────────────────────

/**
 * In-memory transport adapter.
 *
 * Collects all sent responses in an array for test assertions.
 */
export class InMemoryTransport implements TransportAdapter {
  /** All sent responses. */
  private responses: unknown[] = [];

  /** @inheritdoc */
  async send(response: unknown): Promise<void> {
    this.responses.push(response);
  }

  // ── Test helpers ──

  /** Returns all sent responses (for test assertions). */
  getResponses(): ReadonlyArray<unknown> {
    return this.responses;
  }

  /** Resets all sent responses. */
  reset(): void {
    this.responses = [];
  }
}

// ────────────────────────────────────────────────────────────────────────────
// In-Memory Cross-Thread
// ────────────────────────────────────────────────────────────────────────────

/**
 * In-memory cross-thread adapter.
 *
 * Collects all sent messages in an array for test assertions.
 * No real messaging — tests inspect the queue manually.
 */
export class InMemoryCrossThread implements CrossThreadAdapter {
  /** All sent messages. */
  private messages: Array<{
    targetThreadId: string;
    event: string;
    payload: unknown;
  }> = [];

  /** @inheritdoc */
  async send(
    targetThreadId: string,
    event: string,
    payload: unknown,
  ): Promise<void> {
    this.messages.push({ targetThreadId, event, payload });
  }

  // ── Test helpers ──

  /** Returns all sent messages (for test assertions). */
  getMessages(): ReadonlyArray<{
    targetThreadId: string;
    event: string;
    payload: unknown;
  }> {
    return this.messages;
  }

  /** Resets all sent messages. */
  reset(): void {
    this.messages = [];
  }
}
