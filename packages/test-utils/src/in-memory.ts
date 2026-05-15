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
  async list(prefix?: string): Promise<string[]> {
    const keys: string[] = [];
    for (const key of this.data.keys()) {
      if (prefix === undefined || key.startsWith(prefix)) {
        keys.push(key);
      }
    }
    return keys;
  }

  /** @inheritdoc */
  async batch(
    operations: Array<
      | { op: "put"; key: string; value: unknown }
      | { op: "delete"; key: string }
      | { op: "increment"; key: string; amount: number }
      | { op: "cas"; key: string; expected: unknown; next: unknown }
    >,
  ): Promise<void> {
    for (const op of operations) {
      switch (op.op) {
        case "put":
          this.data.set(op.key, op.value);
          break;
        case "delete":
          this.data.delete(op.key);
          break;
        case "increment":
          await this.increment(op.key, op.amount);
          break;
        case "cas": {
          const current = this.data.get(op.key);
          if (current === op.expected) {
            this.data.set(op.key, op.next);
          }
          break;
        }
      }
    }
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
  /** Stored payload for the next alarm. */
  private storedPayload?: {
    executionId: string;
    traceId: string;
    wakeReason: string;
    scheduleId?: string;
  };
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

  /**
   * Schedules an alarm with payload for resuming suspended execution.
   *
   * @param at - Unix timestamp in milliseconds for the wake-up.
   * @param payload - Data to pass when resuming (executionId, traceId, etc.).
   */
  async scheduleAlarm(
    at: number,
    payload: { executionId: string; traceId: string; wakeReason: string },
  ): Promise<void> {
    this.scheduledAt = at;
    this.storedPayload = payload;
    // In-memory implementation stores both timestamp and payload
    // Test harness can fire the alarm manually
  }

  /** @inheritdoc */
  async cancelAlarm(): Promise<void> {
    this.scheduledAt = null;
    this.storedPayload = undefined;
  }

  /** @inheritdoc */
  async popDueAlarms(): Promise<
    {
      executionId: string;
      traceId: string;
      wakeReason: string;
      scheduleId?: string;
    }[]
  > {
    if (
      this.scheduledAt &&
      this.scheduledAt <= Date.now() &&
      this.storedPayload
    ) {
      const payload = this.storedPayload;
      this.scheduledAt = null;
      this.storedPayload = undefined;
      return [payload];
    }
    return [];
  }

  // ── Test helpers ──

  /** Returns the next scheduled timestamp, or null. */
  getScheduledAt(): number | null {
    return this.scheduledAt;
  }

  /** Simulates the alarm firing. Clears the schedule and calls onFire. */
  async fire(): Promise<void> {
    this.scheduledAt = null;
    this.storedPayload = undefined;
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

  /** All agent calls. */
  private agentCalls: Array<{
    targetThreadId: string;
    contract: { name: string; input?: unknown; output?: unknown };
    input: unknown;
  }> = [];

  /** @inheritdoc */
  async send(
    targetThreadId: string,
    event: string,
    payload: unknown,
  ): Promise<void> {
    this.messages.push({ targetThreadId, event, payload });
  }

  /** @inheritdoc */
  async callAgent<TInput, TOutput>(
    targetThreadId: string,
    contract: { name: string; input?: unknown; output?: unknown },
    input: TInput,
  ): Promise<TOutput> {
    // In-memory implementation doesn't actually call other agents
    // Tests can inspect the call via getAgentCalls()
    this.agentCalls.push({ targetThreadId, contract, input });
    // Return a placeholder - tests should mock this behavior as needed
    return undefined as TOutput;
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

  /** Returns all agent calls (for test assertions). */
  getAgentCalls(): ReadonlyArray<{
    targetThreadId: string;
    contract: { name: string; input?: unknown; output?: unknown };
    input: unknown;
  }> {
    return this.agentCalls;
  }

  /** Resets all sent messages and agent calls. */
  reset(): void {
    this.messages = [];
    this.agentCalls = [];
  }
}
