/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  EffectResolver,
  Effect,
  EffectType,
  EffectMap,
} from "../../src/effects/types";
import type {
  EventStore,
  StateStore,
  SchedulerAdapter,
} from "../../src/adapters/interfaces";
import { SuspensionException } from "../../src/engine/suspension";

export class FakeEffectResolver implements EffectResolver {
  constructor(
    private events: EventStore,
    private state: StateStore,
    private scheduler: SchedulerAdapter,
  ) {}

  async resolve<T extends EffectType>(
    effect: Effect<T>,
  ): Promise<EffectMap[T]["result"]> {
    let result: unknown = undefined;

    switch (effect.type as string) {
      case "cache.set": {
        const { key, value } = effect.payload as any;
        await this.state.set(key, value);
        break;
      }
      case "cache.get": {
        const { key } = effect.payload as any;
        result = await this.state.get(key);
        break;
      }
      case "cache.delete": {
        const { key } = effect.payload as any;
        await this.state.delete(key);
        break;
      }
      case "action.waitUntil": {
        const { until } = effect.payload as any;
        await this.scheduler.scheduleAlarm(until, {
          executionId: effect.executionId,
          traceId: effect.traceId,
          threadId: effect.threadId,
          wakeReason: "timer-wake",
        });

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
      }
      case "action.approval": {
        result = { approved: true };
        break;
      }
      default:
        break;
    }

    await this.events.append({
      type: effect.type as any,
      ...(effect.payload as any),
      executionId: effect.executionId,
      traceId: effect.traceId,
      threadId: effect.threadId,
      timestamp: effect.timestamp,
    } as any);

    return result as EffectMap[T]["result"];
  }
}
