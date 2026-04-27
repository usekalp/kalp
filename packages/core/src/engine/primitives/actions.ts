/**
 * Actions primitive — intercepted orchestration intents with event emission.
 *
 * This is the core of the event-sourced runtime model. Every action is an
 * **intent**, not a direct execution. The handler emits the intent, and the
 * reactor resolves it.
 *
 * - `actions.run(step, input)` → emits `action.run`, suspends, reactor enqueues handler, resolves with result
 * - `actions.wait(duration)` → emits `action.wait`, schedules alarm, terminates execution
 * - `actions.loop(body)` → emits `action.loop.start`, reactor drives iterations
 * - `actions.fetch(url, init)` → emits `primitive.invoked`, delegates to http primitive
 *
 * @module
 */

import type { KalpActions, ExecutableNode, InputOf, OutputOf, WakeReason } from '@kalphq/sdk';
import type { ExecutionLog } from '@/engine/execution-log';
import type { SchedulerAdapter } from '@/adapters/interfaces';

/** Callback to dispatch a handler task into the reactor queue. */
export type DispatchAction = (moduleRef: string, input: unknown) => Promise<unknown>;

/**
 * Parses a human-readable duration string (e.g. "5m", "1h", "30s") to milliseconds.
 *
 * @param duration - A string like "5m", "1h", "30s", "2d", or a raw number of ms.
 * @returns Duration in milliseconds.
 */
function parseDuration(duration: string | number): number {
	if (typeof duration === 'number') return duration;

	const match = duration.match(/^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d)$/i);
	if (!match) {
		throw new Error(`Invalid duration format: "${duration}". Expected e.g. "5m", "30s", "1h".`);
	}

	const value = parseFloat(match[1]!);
	const unit = match[2]!.toLowerCase();

	const multipliers: Record<string, number> = {
		ms: 1,
		s: 1_000,
		m: 60_000,
		h: 3_600_000,
		d: 86_400_000,
	};

	return value * (multipliers[unit] ?? 1);
}

/**
 * Creates the intercepted actions primitive for handler context.
 *
 * Each method emits structured events and interacts with the reactor
 * via the `dispatch` callback (for run) and the `scheduler` adapter
 * (for wait).
 *
 * @param log - The execution log for event emission.
 * @param scheduler - The scheduler adapter for deferred execution.
 * @param dispatch - Callback to enqueue a handler task in the reactor.
 * @returns A {@link KalpActions} matching the SDK interface exactly.
 */
export function createActionsPrimitive(log: ExecutionLog, scheduler: SchedulerAdapter, dispatch: DispatchAction): KalpActions {
	let loopCounter = 0;

	return {
		/**
		 * Emits an `action.run` intent and suspends until the reactor resolves it.
		 * The handler receives a Promise that resolves with the step/tool result.
		 */
		async run<T extends ExecutableNode>(node: T, ...args: InputOf<T> extends never ? [] : [input: InputOf<T>]): Promise<OutputOf<T>> {
			const target = `${(node as any).kind}s.${(node as any).id}`;
			const input = args[0];

			await log.emit({
				type: 'action.run',
				target,
				input,
				timestamp: Date.now(),
			});

			const result = await dispatch(target, input);

			await log.emit({
				type: 'action.run.completed',
				target,
				result,
				timestamp: Date.now(),
			});

			return result as OutputOf<T>;
		},

		/**
		 * Emits an `action.wait` event, schedules an alarm, and returns.
		 * The host adapter is responsible for re-entering the reactor when the alarm fires.
		 */
		async wait(duration: string | number): Promise<WakeReason> {
			const ms = parseDuration(duration);

			await log.emit({
				type: 'action.wait',
				duration,
				timestamp: Date.now(),
			});

			await scheduler.schedule(Date.now() + ms);

			// In the event-sourced model, wait terminates the current execution.
			// The alarm fires and re-enters the reactor via handleEvent("onTick").
			// The WakeReason is resolved by the reactor on rehydration.
			return { type: 'timeout' };
		},

		/**
		 * Runtime-driven loop. Each iteration is a separate event, enabling
		 * persistence, rehydration, cut, pause, and per-iteration billing.
		 */
		loop(body: () => Promise<void>): void {
			const loopId = `loop_${++loopCounter}_${Date.now()}`;

			// Fire-and-forget — the reactor drives the loop asynchronously.
			// The handler does NOT await the loop; it registers the intent.
			void (async () => {
				await log.emit({
					type: 'action.loop.start',
					loopId,
					timestamp: Date.now(),
				});

				let iteration = 0;
				// eslint-disable-next-line no-constant-condition
				while (true) {
					await log.emit({
						type: 'action.loop.iteration',
						loopId,
						iteration,
						timestamp: Date.now(),
					});

					try {
						await body();
					} catch (err) {
						await log.emit({
							type: 'action.loop.end',
							loopId,
							reason: err instanceof Error ? err.message : 'error',
							timestamp: Date.now(),
						});
						break;
					}

					iteration++;
				}
			})();
		},

		/**
		 * Intercepted fetch — logs the request and delegates to globalThis.fetch.
		 */
		async fetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
			const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
			const method = init?.method ?? (input instanceof Request ? input.method : 'GET');

			const response = await globalThis.fetch(input, init);

			await log.emit({
				type: 'primitive.invoked',
				name: 'actions.fetch',
				params: { url, method },
				result: { status: response.status },
				timestamp: Date.now(),
			});

			return response;
		},
	};
}
