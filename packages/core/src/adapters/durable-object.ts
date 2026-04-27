/**
 * Durable Object adapter implementations for Cloudflare Workers.
 *
 * These adapters translate the reactor's abstract interfaces into concrete
 * Durable Object operations (SQLite storage, alarm API). The DO is a thin
 * shell — all orchestration logic lives in the reactor.
 *
 * @module
 */

import type { PersistenceAdapter, SchedulerAdapter, TransportAdapter } from '@/adapters/interfaces';
import type { ExecutionEvent } from '@/engine/types';

// ────────────────────────────────────────────────────────────────────────────
// DO Persistence Adapter
// ────────────────────────────────────────────────────────────────────────────

/**
 * Persistence adapter backed by Durable Object SQLite storage.
 *
 * Uses two tables:
 * - `events` — append-only execution log
 * - `state` — key-value agent state
 *
 * Both tables are created lazily on first use.
 */
export class DurableObjectPersistence implements PersistenceAdapter {
	/** Whether the DB tables have been initialized. */
	private initialized = false;

	/**
	 * @param storage - The Durable Object's `DurableObjectStorage` instance.
	 */
	constructor(private storage: DurableObjectStorage) {}

	/**
	 * Ensures the SQLite tables exist. Called lazily before any read/write.
	 */
	private ensureSchema(): void {
		if (this.initialized) return;
		this.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch('now','subsec') * 1000)
      )
    `);
		this.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);
		this.initialized = true;
	}

	/** @inheritdoc */
	async appendEvent(event: ExecutionEvent): Promise<void> {
		this.ensureSchema();
		this.storage.sql.exec('INSERT INTO events (type, payload) VALUES (?, ?)', event.type, JSON.stringify(event));
	}

	/** @inheritdoc */
	async loadEvents(): Promise<ExecutionEvent[]> {
		this.ensureSchema();
		const cursor = this.storage.sql.exec('SELECT payload FROM events ORDER BY id ASC');
		const events: ExecutionEvent[] = [];
		for (const row of cursor) {
			events.push(JSON.parse(String(row.payload)) as ExecutionEvent);
		}
		return events;
	}

	/** @inheritdoc */
	async getState(key: string): Promise<unknown> {
		this.ensureSchema();
		const cursor = this.storage.sql.exec('SELECT value FROM state WHERE key = ?', key);
		const row = cursor.next().value;
		if (!row) return null;
		return JSON.parse(String(row.value));
	}

	/** @inheritdoc */
	async setState(key: string, value: unknown): Promise<void> {
		this.ensureSchema();
		this.storage.sql.exec('INSERT OR REPLACE INTO state (key, value) VALUES (?, ?)', key, JSON.stringify(value));
	}

	/** @inheritdoc */
	async deleteState(key: string): Promise<void> {
		this.ensureSchema();
		this.storage.sql.exec('DELETE FROM state WHERE key = ?', key);
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
