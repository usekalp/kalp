/**
 * Orchestration Reactor — the Kalp v2 event-sourced execution engine.
 *
 * The reactor is **infrastructure-agnostic**. It receives events, processes
 * tasks from an internal queue, and delegates all IO to adapter interfaces.
 * When the queue is empty, control returns to the host adapter (Durable Object,
 * Node process, test harness, etc.) which waits for the next external event.
 *
 * Key invariants:
 * - The reactor never imports Cloudflare, Node, or any platform API.
 * - Every operation emits structured events to the {@link ExecutionLog}.
 * - Handler execution is sandboxed via intercepted primitives.
 * - `actions.run` is an intent + suspend, not a direct call.
 *
 * @module
 */

import type { IRGraph, IRNodeId } from '@kalphq/sdk';
import type { PersistenceAdapter, SchedulerAdapter } from '@/adapters/interfaces';
import type { ExecutionTask, RuntimeEvent, HandlerModule } from '@/engine/types';
import type { RuntimeProviders } from '@/engine/context-builder';
import { ExecutionLog } from '@/engine/execution-log';
import { buildHandlerContext } from '@/engine/context-builder';

/**
 * The Kalp v2 Orchestration Reactor.
 *
 * Processes external events by looking up the corresponding IR entry,
 * executing the handler chain, and emitting structured events for every
 * operation. The reactor is portable — it works in Durable Objects, Node,
 * or any environment that provides the adapter interfaces.
 */
export class OrchestrationReactor {
	/** The execution log (single source of truth). */
	public readonly log: ExecutionLog;
	/** The IR graph (structural index only). */
	public readonly ir: IRGraph;

	/** Internal task queue. */
	private queue: ExecutionTask[] = [];
	/** Bundled handler modules keyed by moduleRef. */
	private bundles: Map<string, HandlerModule>;
	/** Persistence adapter (state + events). */
	private persistence: PersistenceAdapter;
	/** Scheduler adapter (alarms). */
	private scheduler: SchedulerAdapter;
	/** External providers (ai, auth, memory, vault). */
	private providers: RuntimeProviders;
	/** Result of the last completed handler. */
	private lastResult: unknown = undefined;

	/**
	 * Creates a new reactor instance.
	 *
	 * @param ir - The compiled IR graph.
	 * @param bundles - Map from moduleRef to bundled handler module.
	 * @param persistence - Persistence adapter for state and event log.
	 * @param scheduler - Scheduler adapter for deferred wake-ups.
	 * @param providers - External providers for ai, auth, memory, vault.
	 */
	constructor(
		ir: IRGraph,
		bundles: Map<string, HandlerModule>,
		persistence: PersistenceAdapter,
		scheduler: SchedulerAdapter,
		providers: RuntimeProviders,
	) {
		this.ir = ir;
		this.bundles = bundles;
		this.persistence = persistence;
		this.scheduler = scheduler;
		this.providers = providers;
		this.log = new ExecutionLog(persistence);
	}

	// ──────────────────────────────────────────────────────────────────────────
	// Public API (called by host adapter)
	// ──────────────────────────────────────────────────────────────────────────

	/**
	 * Handles an external event by resolving the IR entry and processing
	 * the handler chain until the queue is empty.
	 *
	 * @param event - The external runtime event.
	 * @returns The result of the last completed handler.
	 * @throws If no entry exists for the event type.
	 */
	async handleEvent(event: RuntimeEvent): Promise<unknown> {
		const entryId = this.ir.entries[event.type];
		if (!entryId) {
			throw new Error(`No entry for event: ${event.type}`);
		}

		await this.log.emit({
			type: 'node.started',
			nodeId: entryId,
			timestamp: Date.now(),
		});

		this.queue.push({ nodeId: entryId, context: event.payload });
		await this.processUntilIdle();

		return this.lastResult;
	}

	/**
	 * Drains the task queue. Called internally after handleEvent and recursively
	 * after actions.run dispatches. When the queue is empty, control returns to
	 * the host adapter.
	 */
	async processUntilIdle(): Promise<void> {
		while (this.queue.length > 0) {
			const task = this.queue.shift()!;
			await this.processTask(task);
		}
	}

	// ──────────────────────────────────────────────────────────────────────────
	// Internal task processing
	// ──────────────────────────────────────────────────────────────────────────

	/**
	 * Processes a single task from the queue.
	 *
	 * - **Entry nodes**: traverse sequential edges to find the handler.
	 * - **Handler nodes**: build context, execute handler, emit events.
	 */
	private async processTask(task: ExecutionTask): Promise<void> {
		const node = this.ir.nodes[task.nodeId];
		if (!node) {
			await this.log.emit({
				type: 'error',
				nodeId: task.nodeId,
				error: `Node "${task.nodeId}" not found in IR.`,
				timestamp: Date.now(),
			});
			return;
		}

		switch (node.kind) {
			case 'entry': {
				// Entry nodes are pass-through — enqueue successors
				this.enqueueSuccessors(task.nodeId, task.context);
				break;
			}

			case 'handler': {
				await this.log.emit({
					type: 'node.started',
					nodeId: node.id,
					timestamp: Date.now(),
				});

				const handlerModule = this.bundles.get(node.moduleRef);
				if (!handlerModule) {
					await this.log.emit({
						type: 'error',
						nodeId: node.id,
						error: `Handler module "${node.moduleRef}" not found in bundles.`,
						timestamp: Date.now(),
					});
					return;
				}

				// Build intercepted context with dispatch callback
				const dispatch = this.createDispatch();
				const ctx = buildHandlerContext(this.log, this.persistence, this.scheduler, dispatch, this.providers);

				// Execute handler in sandboxed context
				try {
					const result = await handlerModule.default(ctx, task.context);

					await this.log.emit({
						type: 'node.completed',
						nodeId: node.id,
						result,
						timestamp: Date.now(),
					});

					this.lastResult = result;

					// If this task was dispatched by actions.run, resolve the caller's promise
					if (task.resolve) {
						task.resolve(result);
					}

					// Continue to sequential successors
					this.enqueueSuccessors(task.nodeId, { ...(task.context as object), result });
				} catch (err) {
					const message = err instanceof Error ? err.message : String(err);
					await this.log.emit({
						type: 'error',
						nodeId: node.id,
						error: message,
						timestamp: Date.now(),
					});

					// Re-throw to let the host adapter handle it
					throw err;
				}
				break;
			}
		}
	}

	/**
	 * Enqueues all successor nodes connected by outgoing edges from the given node.
	 *
	 * @param nodeId - The source node ID.
	 * @param context - The context to pass to successor tasks.
	 */
	private enqueueSuccessors(nodeId: IRNodeId, context: unknown): void {
		const outEdges = this.ir.edges.filter((e) => e.from === nodeId);
		for (const edge of outEdges) {
			this.queue.push({ nodeId: edge.to, context });
		}
	}

	/**
	 * Creates a dispatch function for actions.run.
	 *
	 * When a handler calls `actions.run(step, input)`, this function:
	 * 1. Looks up the handler node by moduleRef in the IR.
	 * 2. Creates a task with a resolve callback.
	 * 3. Returns a Promise that resolves when the task completes.
	 */
	private createDispatch(): (moduleRef: string, input: unknown) => Promise<unknown> {
		return (moduleRef: string, input: unknown): Promise<unknown> => {
			// Find the handler node in the IR by moduleRef
			let handlerNodeId: IRNodeId | null = null;

			for (const [id, node] of Object.entries(this.ir.nodes)) {
				if (node.kind === 'handler' && node.moduleRef === moduleRef) {
					handlerNodeId = id as IRNodeId;
					break;
				}
			}

			if (!handlerNodeId) {
				return Promise.reject(new Error(`Cannot dispatch: handler "${moduleRef}" not found in IR.`));
			}

			const targetId = handlerNodeId;
			return new Promise<unknown>((resolve) => {
				this.queue.push({
					nodeId: targetId,
					context: input,
					resolve,
				});
			});
		};
	}
}
