/**
 * HTTP primitive — intercepted fetch with event emission.
 *
 * Every outbound HTTP request is logged to the execution log.
 * The actual fetch is delegated to the runtime's fetch implementation.
 *
 * @module
 */

import type { ExecutionLog } from '@/engine/execution-log';

/**
 * Creates an intercepted fetch function that emits events for every call.
 *
 * @param log - The execution log for event emission.
 * @returns A fetch function matching the standard `fetch` signature.
 */
export function createHttpPrimitive(log: ExecutionLog): (input: string | URL | Request, init?: RequestInit) => Promise<Response> {
	return async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
		const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
		const method = init?.method ?? (input instanceof Request ? input.method : 'GET');

		const response = await globalThis.fetch(input, init);

		await log.emit({
			type: 'primitive.invoked',
			name: 'http.fetch',
			params: { url, method },
			result: { status: response.status, statusText: response.statusText },
			timestamp: Date.now(),
		});

		return response;
	};
}
