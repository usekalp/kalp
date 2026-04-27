/**
 * Storage primitive — intercepted key-value state with event emission.
 *
 * Every read/write is logged to the execution log. The actual storage
 * is delegated to the {@link PersistenceAdapter}.
 *
 * @module
 */

import type { PersistenceAdapter } from '@/adapters/interfaces';
import type { ExecutionLog } from '@/engine/execution-log';

/**
 * The shape of the `storage` primitive exposed to handler context.
 * Matches the SDK's `HandlerContext.storage` interface exactly.
 */
export interface StoragePrimitive {
	get: <T = unknown>(key: string) => Promise<T | null>;
	put: (key: string, value: unknown) => Promise<void>;
	delete: (key: string) => Promise<void>;
}

/**
 * Creates an intercepted storage primitive that emits events for every operation.
 *
 * @param persistence - The persistence adapter for actual state storage.
 * @param log - The execution log for event emission.
 * @returns A {@link StoragePrimitive} matching the SDK's storage API.
 */
export function createStoragePrimitive(persistence: PersistenceAdapter, log: ExecutionLog): StoragePrimitive {
	return {
		async get<T = unknown>(key: string): Promise<T | null> {
			const value = await persistence.getState(key);
			await log.emit({
				type: 'state.read',
				key,
				value,
				timestamp: Date.now(),
			});
			return value as T | null;
		},

		async put(key: string, value: unknown): Promise<void> {
			await persistence.setState(key, value);
			await log.emit({
				type: 'state.write',
				key,
				value,
				timestamp: Date.now(),
			});
		},

		async delete(key: string): Promise<void> {
			await persistence.deleteState(key);
			await log.emit({
				type: 'state.write',
				key,
				value: undefined,
				timestamp: Date.now(),
			});
		},
	};
}
