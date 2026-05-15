/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-case-declarations */
import type { EffectResolver, Effect } from "../../src/engine/types";
import type {
  EventStore,
  StateStore,
  SchedulerAdapter,
} from "../../src/adapters/interfaces";
import { SuspensionException } from "../../src/engine/suspension";

export class FakeEffectResolver implements EffectResolver {
  public onListenerQueued?: (
    entryKey: string,
    payload: unknown,
    traceId: string,
  ) => Promise<void>;

  constructor(
    private events: EventStore,
    private state: StateStore,
    private scheduler: SchedulerAdapter,
  ) {}

  async resolve(effect: Effect): Promise<unknown> {
    let result: unknown = undefined;

    switch (effect.type) {
      case "storage.put":
        const { key: putKey, value: putValue } = effect.payload as any;
        await this.state.set(`__state:${putKey}`, putValue);
        // For backwards compatibility with tests that don't use prefixes
        await this.state.set(putKey, putValue);
        break;

      case "storage.batch":
        const { operations } = effect.payload as any;
        await this.state.batch(operations);
        break;

      case "storage.get":
        const { key: getKey } = effect.payload as any;
        result = await this.state.get(`__state:${getKey}`);
        if (result === undefined) {
          result = await this.state.get(getKey);
        }
        break;

      case "action.waitUntil":
        const { until } = effect.payload as any;
        await this.scheduler.scheduleAlarm(until, {
          executionId: effect.executionId,
          traceId: effect.traceId,
          threadId: effect.threadId,
          wakeReason: "timer-wake",
        });

        // Log the suspension intent before throwing
        await this.events.append({
          type: "action.suspend",
          resumeAt: until,
          wakeReason: "timer-wake",
          executionId: effect.executionId,
          traceId: effect.traceId,
          threadId: effect.threadId,
          timestamp: effect.timestamp,
        });

        throw new SuspensionException(until, "timer-wake", {}, effect.seq);

      case "action.emit": {
        const { event: emitEvent, data, options } = effect.payload as any;
        const envelope = {
          eventName: emitEvent,
          payload: data,
          traceId: effect.traceId,
          parentExecutionId: effect.executionId,
          sourceAgentId: options?.sourceAgentId ?? "test-runtime-agent",
        };
        // Log emit.dispatched for causality tests
        await this.events.append({
          type: "emit.dispatched",
          payload: envelope,
          executionId: effect.executionId,
          traceId: effect.traceId,
          threadId: effect.threadId,
          timestamp: Date.now(),
        });
        // Also log listener.queued as in old tests
        await this.events.append({
          type: "listener.queued",
          listenerEntryKey: `listener:test-runtime-agent:${emitEvent}:0`,
          payload: envelope,
          executionId: effect.executionId,
          traceId: effect.traceId,
          threadId: effect.threadId,
          timestamp: Date.now(),
        });

        // Execute listener synchronously for tests to pass
        if (this.onListenerQueued) {
          await this.onListenerQueued(
            `listener:test-runtime-agent:${emitEvent}:0`,
            data,
            effect.traceId,
          );
        }
        break;
      }

      default:
        break;
    }

    // Persist the effect to event store just like the old proxy did
    await this.events.append({
      type: effect.type as any, // Map generic effect type to ExecutionEvent type for testing
      ...(effect.payload as any),
      executionId: effect.executionId,
      traceId: effect.traceId,
      threadId: effect.threadId,
      timestamp: effect.timestamp,
    });

    return result;
  }
}
