/**
 * Structured execution log for the Kalp v2 Orchestration Reactor.
 *
 * The execution log is the system's source of truth. Every runtime operation
 * emits a structured event that is persisted via the {@link PersistenceAdapter}.
 * This enables replay, time-travel debugging, billing, and observability.
 *
 * Rule: **If it doesn't emit an event, it doesn't exist.**
 *
 * @module
 */

import type { PersistenceAdapter } from '@/adapters/interfaces';
import type { ExecutionEvent } from '@/engine/types';

/**
 * Append-only structured event log backed by a {@link PersistenceAdapter}.
 *
 * All reactor operations flow through this class. It provides a unified
 * interface for emitting and loading events regardless of the underlying
 * storage mechanism.
 */
export class ExecutionLog {
	/** In-memory buffer of events emitted during the current processing cycle. */
	private buffer: ExecutionEvent[] = [];

	/**
	 * Creates a new execution log backed by the given persistence adapter.
	 *
	 * @param persistence - The adapter used to persist and load events.
	 */
	constructor(private persistence: PersistenceAdapter) {}

	/**
	 * Emits a structured execution event.
	 *
	 * The event is immediately persisted via the adapter and buffered in memory
	 * for the current processing cycle.
	 *
	 * @param event - The execution event to emit.
	 */
	async emit(event: ExecutionEvent): Promise<void> {
		this.buffer.push(event);
		await this.persistence.appendEvent(event);
	}

	/**
	 * Loads all previously persisted events from the adapter.
	 *
	 * Used for replay, rehydration, and debugging.
	 *
	 * @returns An ordered array of all persisted execution events.
	 */
	async load(): Promise<ExecutionEvent[]> {
		return this.persistence.loadEvents();
	}

	/**
	 * Returns events emitted during the current processing cycle (in-memory only).
	 *
	 * @returns The in-memory event buffer.
	 */
	getBuffer(): ReadonlyArray<ExecutionEvent> {
		return this.buffer;
	}

	/**
	 * Clears the in-memory buffer. Called between processing cycles.
	 */
	clearBuffer(): void {
		this.buffer = [];
	}
}
