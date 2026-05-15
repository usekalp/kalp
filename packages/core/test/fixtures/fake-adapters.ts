/**
 * Fake In-Memory Adapters for testing.
 *
 * These adapters provide fully in-memory implementations of the core
 * adapter interfaces, allowing tests to run without external dependencies.
 *
 * @module
 */

import type {
  StateStore,
  EventStore,
  SchedulerAdapter,
  AlarmPayload,
} from "../../src/adapters/interfaces";
import type { ExecutionEvent } from "../../src/engine/types";

/**
 * Fake StateStore implementation using in-memory Map.
 */
export class FakeStateStore implements StateStore {
  private store = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | undefined> {
    return this.store.get(key) as T | undefined;
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.store.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async list(prefix?: string): Promise<string[]> {
    const keys = Array.from(this.store.keys());
    if (prefix) {
      return keys.filter((k) => k.startsWith(prefix));
    }
    return keys;
  }

  async increment(key: string, delta?: number): Promise<number> {
    const current = (this.store.get(key) as number) ?? 0;
    const newValue = current + (delta ?? 1);
    this.store.set(key, newValue);
    return newValue;
  }

  async batch(operations: Array<
    | { op: "put"; key: string; value: unknown }
    | { op: "delete"; key: string }
    | { op: "increment"; key: string; amount: number }
    | { op: "cas"; key: string; expected: unknown; next: unknown }
  >): Promise<void> {
    for (const op of operations) {
      switch (op.op) {
        case "put":
          this.store.set(op.key, op.value);
          break;
        case "delete":
          this.store.delete(op.key);
          break;
        case "increment":
          {
            const current = (this.store.get(op.key) as number) ?? 0;
            this.store.set(op.key, current + op.amount);
          }
          break;
        case "cas":
          {
            const current = this.store.get(op.key);
            if (JSON.stringify(current) === JSON.stringify(op.expected)) {
              this.store.set(op.key, op.next);
            }
          }
          break;
      }
    }
  }

  // ThreadStore methods
  async getMeta(threadId: string): Promise<Record<string, unknown> | null> {
    return this.store.get(`__meta_${threadId}`) as Record<
      string,
      unknown
    > | null;
  }

  async setMeta(
    threadId: string,
    meta: Record<string, unknown>,
  ): Promise<void> {
    this.store.set(`__meta_${threadId}`, meta);
  }

  clear(): void {
    this.store.clear();
  }
}

/**
 * Fake EventStore implementation using in-memory array.
 */
export class FakeEventStore implements EventStore {
  private events: ExecutionEvent[] = [];

  async append(event: ExecutionEvent): Promise<void> {
    this.events.push(event);
  }

  async loadByThread(threadId: string): Promise<ExecutionEvent[]> {
    return this.events.filter((e) => e.threadId === threadId);
  }

  async loadByTrace(traceId: string): Promise<ExecutionEvent[]> {
    return this.events.filter((e) => e.traceId === traceId);
  }

  async loadAll(): Promise<ExecutionEvent[]> {
    return [...this.events];
  }

  async loadByExecutionId(executionId: string): Promise<ExecutionEvent[]> {
    return this.events.filter((e) => {
      const intentEvent = e;
      return intentEvent.executionId === executionId;
    });
  }

  clear(): void {
    this.events = [];
  }

  getEvents(): ExecutionEvent[] {
    return [...this.events];
  }
}

/**
 * Fake SchedulerAdapter implementation using in-memory priority queue.
 */
export class FakeScheduler implements SchedulerAdapter {
  private alarms: Array<{ at: number; payload: AlarmPayload }> = [];
  private currentTime = Date.now();

  async scheduleAlarm(at: number, payload: AlarmPayload): Promise<void> {
    // Contract: replace any existing alarm
    this.alarms = [{ at, payload }];
  }

  async cancelAlarm(): Promise<void> {
    this.alarms = [];
  }

  async popDueAlarms(): Promise<AlarmPayload[]> {
    const due: AlarmPayload[] = [];
    const now = this.currentTime;

    // Find all alarms that are due
    while (this.alarms.length > 0 && this.alarms[0]!.at <= now) {
      due.push(this.alarms.shift()!.payload);
    }

    return due;
  }

  /**
   * Advance simulated time and return due alarms.
   */
  advanceTime(ms: number): Promise<AlarmPayload[]> {
    this.currentTime += ms;
    return this.popDueAlarms();
  }

  /**
   * Get the next scheduled alarm timestamp.
   */
  getNextAlarmTime(): number | undefined {
    return this.alarms[0]?.at;
  }

  /**
   * Get all scheduled alarms.
   */
  getAlarms(): Array<{ at: number; payload: AlarmPayload }> {
    return [...this.alarms];
  }

  clear(): void {
    this.alarms = [];
    this.currentTime = Date.now();
  }

  setCurrentTime(time: number): void {
    this.currentTime = time;
  }

  getCurrentTime(): number {
    return this.currentTime;
  }
}

/**
 * Composite fake persistence adapter.
 */
export function createFakeAdapters() {
  const state = new FakeStateStore();
  const events = new FakeEventStore();
  const scheduler = new FakeScheduler();

  return {
    state,
    events,
    scheduler,
    clearAll() {
      state.clear();
      events.clear();
      scheduler.clear();
    },
  };
}
