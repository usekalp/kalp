/**
 * In-memory adapter implementations for local dev and testing.
 *
 * These adapters store everything in memory — no persistence, no real alarms.
 * Ideal for unit tests, local dev, and integration testing without infrastructure.
 *
 * @module
 */

import type { PersistenceAdapter, SchedulerAdapter, TransportAdapter } from '@/adapters/interfaces';
import type { ExecutionEvent } from '@/engine/types';

// ────────────────────────────────────────────────────────────────────────────
// In-Memory Persistence
// ────────────────────────────────────────────────────────────────────────────

/**
 * In-memory persistence adapter.
 *
 * Events are stored in an array, state in a Map. Nothing survives process restart.
 * Used in tests and local development.
 */
export class InMemoryPersistence implements PersistenceAdapter {
	/** Append-only event log. */
	private events: ExecutionEvent[] = [];
	/** Key-value state store. */
	private state = new Map<string, unknown>();

	/** @inheritdoc */
	async appendEvent(event: ExecutionEvent): Promise<void> {
		this.events.push(event);
	}

	/** @inheritdoc */
	async loadEvents(): Promise<ExecutionEvent[]> {
		return [...this.events];
	}

	/** @inheritdoc */
	async getState(key: string): Promise<unknown> {
		return this.state.get(key) ?? null;
	}

	/** @inheritdoc */
	async setState(key: string, value: unknown): Promise<void> {
		this.state.set(key, value);
	}

	/** @inheritdoc */
	async deleteState(key: string): Promise<void> {
		this.state.delete(key);
	}

	// ── Test helpers ──

	/** Returns all persisted events (for test assertions). */
	getEvents(): ReadonlyArray<ExecutionEvent> {
		return this.events;
	}

	/** Returns all state entries (for test assertions). */
	getStateSnapshot(): ReadonlyMap<string, unknown> {
		return this.state;
	}

	/** Resets all data. */
	reset(): void {
		this.events = [];
		this.state.clear();
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
