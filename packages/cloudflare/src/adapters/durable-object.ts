/**
 * Durable Object adapter implementations for Cloudflare Workers.
 *
 * These adapters translate the reactor's abstract interfaces into concrete
 * Durable Object operations (SQLite storage, alarm API). The DO is a thin
 * shell — all orchestration logic lives in the reactor.
 *
 * This file contains ONLY storage mapping logic. No runtime behavior,
 * no retry logic, no scheduler hacks.
 *
 * @module
 */

import type {
  PersistenceAdapter,
  SchedulerAdapter,
  TransportAdapter,
  StateStore,
  EventStore,
  IdempotencyStore,
  ThreadStore,
  ExecutionEvent,
} from "@kalphq/core";

// ────────────────────────────────────────────────────────────────────────────
// DO Sub-stores
// ────────────────────────────────────────────────────────────────────────────

/**
 * Ensures the SQLite tables exist for event log and state.
 * Called once per DO lifecycle.
 *
 * @param storage - The Durable Object's `DurableObjectStorage` instance.
 */
function ensureSchema(storage: DurableObjectStorage): void {
  storage.sql.exec(`
		CREATE TABLE IF NOT EXISTS events (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			type TEXT NOT NULL,
			thread_id TEXT,
			trace_id TEXT,
			execution_id TEXT,
			payload TEXT NOT NULL,
			created_at INTEGER NOT NULL DEFAULT (unixepoch('now','subsec') * 1000)
		)
	`);
  storage.sql.exec(`
		CREATE TABLE IF NOT EXISTS state (
			key TEXT PRIMARY KEY,
			value TEXT NOT NULL
		)
	`);
  storage.sql.exec(`
		CREATE TABLE IF NOT EXISTS idempotency (
			key TEXT PRIMARY KEY,
			value TEXT NOT NULL,
			expires_at INTEGER
		)
	`);
  storage.sql.exec(`
		CREATE TABLE IF NOT EXISTS thread_meta (
			thread_id TEXT PRIMARY KEY,
			meta TEXT NOT NULL
		)
	`);
}

/**
 * DO-backed state store (KV via SQLite).
 */
export class DOStateStore implements StateStore {
  constructor(private storage: DurableObjectStorage) {}

  /** @inheritdoc */
  async get(key: string): Promise<unknown> {
    const cursor = this.storage.sql.exec(
      "SELECT value FROM state WHERE key = ?",
      key,
    );
    const row = cursor.next().value;
    if (!row) return null;
    return JSON.parse(String(row.value));
  }

  /** @inheritdoc */
  async set(key: string, value: unknown): Promise<void> {
    this.storage.sql.exec(
      "INSERT OR REPLACE INTO state (key, value) VALUES (?, ?)",
      key,
      JSON.stringify(value),
    );
  }

  /** @inheritdoc */
  async delete(key: string): Promise<void> {
    this.storage.sql.exec("DELETE FROM state WHERE key = ?", key);
  }

  /** @inheritdoc */
  async transaction<T>(fn: (tx: StateStore) => Promise<T>): Promise<T> {
    // DO storage operations within a single request are already atomic.
    // Wrap in storage.transaction for multi-key atomicity.
    return this.storage.transaction(async () => fn(this));
  }
}

/**
 * DO-backed event store (append-only SQLite table).
 */
export class DOEventStore implements EventStore {
  constructor(private storage: DurableObjectStorage) {}

  /** @inheritdoc */
  async append(event: ExecutionEvent): Promise<void> {
    const threadId = "threadId" in event ? event.threadId : null;
    const traceId = "traceId" in event ? event.traceId : null;
    const executionId = "executionId" in event ? event.executionId : null;
    this.storage.sql.exec(
      "INSERT INTO events (type, thread_id, trace_id, execution_id, payload) VALUES (?, ?, ?, ?, ?)",
      event.type,
      threadId,
      traceId,
      executionId,
      JSON.stringify(event),
    );
  }

  /** @inheritdoc */
  async loadAll(): Promise<ExecutionEvent[]> {
    const cursor = this.storage.sql.exec(
      "SELECT payload FROM events ORDER BY id ASC",
    );
    const events: ExecutionEvent[] = [];
    for (const row of cursor) {
      events.push(JSON.parse(String(row.payload)) as ExecutionEvent);
    }
    return events;
  }

  /** @inheritdoc */
  async loadByThread(threadId: string): Promise<ExecutionEvent[]> {
    const cursor = this.storage.sql.exec(
      "SELECT payload FROM events WHERE thread_id = ? ORDER BY id ASC",
      threadId,
    );
    const events: ExecutionEvent[] = [];
    for (const row of cursor) {
      events.push(JSON.parse(String(row.payload)) as ExecutionEvent);
    }
    return events;
  }

  /** @inheritdoc */
  async loadByTrace(traceId: string): Promise<ExecutionEvent[]> {
    const cursor = this.storage.sql.exec(
      "SELECT payload FROM events WHERE trace_id = ? ORDER BY id ASC",
      traceId,
    );
    const events: ExecutionEvent[] = [];
    for (const row of cursor) {
      events.push(JSON.parse(String(row.payload)) as ExecutionEvent);
    }
    return events;
  }
}

/**
 * DO-backed idempotency store (KV with TTL via SQLite).
 */
export class DOIdempotencyStore implements IdempotencyStore {
  constructor(private storage: DurableObjectStorage) {}

  /** @inheritdoc */
  async get(key: string): Promise<unknown | null> {
    const cursor = this.storage.sql.exec(
      "SELECT value, expires_at FROM idempotency WHERE key = ?",
      key,
    );
    const row = cursor.next().value;
    if (!row) return null;
    const expiresAt = row.expires_at as number | null;
    if (expiresAt && Date.now() > expiresAt) {
      this.storage.sql.exec("DELETE FROM idempotency WHERE key = ?", key);
      return null;
    }
    return JSON.parse(String(row.value));
  }

  /** @inheritdoc */
  async set(
    key: string,
    result: unknown,
    opts?: { ttlMs?: number },
  ): Promise<void> {
    const expiresAt = opts?.ttlMs ? Date.now() + opts.ttlMs : null;
    this.storage.sql.exec(
      "INSERT OR REPLACE INTO idempotency (key, value, expires_at) VALUES (?, ?, ?)",
      key,
      JSON.stringify(result),
      expiresAt,
    );
  }
}

/**
 * DO-backed thread metadata store (SQLite table).
 */
export class DOThreadStore implements ThreadStore {
  constructor(private storage: DurableObjectStorage) {}

  /** @inheritdoc */
  async getMeta(threadId: string): Promise<Record<string, unknown> | null> {
    const cursor = this.storage.sql.exec(
      "SELECT meta FROM thread_meta WHERE thread_id = ?",
      threadId,
    );
    const row = cursor.next().value;
    if (!row) return null;
    return JSON.parse(String(row.meta));
  }

  /** @inheritdoc */
  async setMeta(
    threadId: string,
    meta: Record<string, unknown>,
  ): Promise<void> {
    this.storage.sql.exec(
      "INSERT OR REPLACE INTO thread_meta (thread_id, meta) VALUES (?, ?)",
      threadId,
      JSON.stringify(meta),
    );
  }
}

// ────────────────────────────────────────────────────────────────────────────
// DO Persistence (composite)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Composite persistence adapter backed by Durable Object SQLite storage.
 *
 * Decomposes into 4 sub-stores (state, events, idempotency, threads).
 * Schema is lazily initialized on first access.
 */
export class DurableObjectPersistence implements PersistenceAdapter {
  readonly state: DOStateStore;
  readonly events: DOEventStore;
  readonly idempotency: DOIdempotencyStore;
  readonly threads: DOThreadStore;
  private schemaReady = false;

  /**
   * @param storage - The Durable Object's `DurableObjectStorage` instance.
   */
  constructor(private storage: DurableObjectStorage) {
    this.state = new DOStateStore(storage);
    this.events = new DOEventStore(storage);
    this.idempotency = new DOIdempotencyStore(storage);
    this.threads = new DOThreadStore(storage);
  }

  /**
   * Ensures schema exists. Called by the DO shell before first reactor use.
   */
  ensureReady(): void {
    if (this.schemaReady) return;
    ensureSchema(this.storage);
    this.schemaReady = true;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// DO Scheduler Adapter
// ────────────────────────────────────────────────────────────────────────────

/**
 * Scheduler adapter backed by Durable Object alarms.
 *
 * Each `schedule()` call sets a DO alarm. When the alarm fires,
 * the host DO class re-enters the reactor via `handleEvent("onTick")`.
 */
export class DurableObjectScheduler implements SchedulerAdapter {
  /**
   * @param storage - The Durable Object's `DurableObjectStorage` instance.
   */
  constructor(private storage: DurableObjectStorage) {}

  /** @inheritdoc */
  async schedule(at: number): Promise<void> {
    await this.storage.setAlarm(at);
  }

  /** @inheritdoc */
  async cancel(): Promise<void> {
    await this.storage.deleteAlarm();
  }
}

// ────────────────────────────────────────────────────────────────────────────
// DO WebSocket Transport Adapter
// ────────────────────────────────────────────────────────────────────────────

/**
 * Transport adapter backed by Durable Object WebSocket hibernation API.
 *
 * Broadcasts the response to all connected WebSocket clients except
 * the sender (if provided).
 */
export class DurableObjectTransport implements TransportAdapter {
  /**
   * @param ctx - The Durable Object's state context (for `getWebSockets()`).
   * @param excludeSocket - Optional socket to exclude from broadcast.
   */
  constructor(
    private ctx: DurableObjectState,
    private excludeSocket?: WebSocket,
  ) {}

  /** @inheritdoc */
  async send(response: unknown): Promise<void> {
    const payload = JSON.stringify(response);
    const sockets = this.ctx.getWebSockets();
    for (const ws of sockets) {
      if (ws !== this.excludeSocket) {
        ws.send(payload);
      }
    }
  }
}
