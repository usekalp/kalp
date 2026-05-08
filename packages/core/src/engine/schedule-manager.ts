/**
 * Schedule manager for the Kalp Proxy-Listener Runtime.
 *
 * Manages multiple concurrent schedules in Core. The adapter only
 * sets a single physical timer via scheduleAlarm. Core handles
 * the logical schedule queue, scheduling the next due alarm.
 *
 * @module
 */

import type { StateStore, SchedulerAdapter } from "@/adapters/interfaces";

/**
 * Schedule state stored in StateStore.
 */
interface ScheduleState {
  schedules: Record<
    string,
    {
      cron: string;
      timezone?: string;
      nextRunAt: number;
      handlerHash: string;
      input?: unknown;
    }
  >;
}

/**
 * Schedule manager for handling multiple concurrent schedules.
 */
export class ScheduleManager {
  private readonly stateKey = "__kalp_schedules__";

  constructor(
    private state: StateStore,
    private scheduler: SchedulerAdapter,
  ) {}

  /**
   * Registers a new schedule.
   *
   * @param scheduleId - Unique identifier for this schedule.
   * @param cron - Cron expression defining the schedule.
   * @param handlerHash - Hash of the handler to execute.
   * @param input - Optional input payload for the handler.
   * @param timezone - Optional timezone for cron evaluation.
   * @returns The next scheduled run timestamp.
   */
  async registerSchedule(
    scheduleId: string,
    cron: string,
    handlerHash: string,
    input?: unknown,
    timezone?: string,
  ): Promise<number> {
    const state = await this.loadState();
    const nextRunAt = this.calculateNextRun(cron, timezone);

    state.schedules[scheduleId] = {
      cron,
      timezone,
      nextRunAt,
      handlerHash,
      input,
    };

    await this.saveState(state);
    await this.scheduleNextAlarm(state);

    return nextRunAt;
  }

  /**
   * Cancels a registered schedule.
   *
   * @param scheduleId - The schedule identifier to cancel.
   * @returns True if a schedule was cancelled, false if not found.
   */
  async cancelSchedule(scheduleId: string): Promise<boolean> {
    const state = await this.loadState();

    if (!state.schedules[scheduleId]) {
      return false;
    }

    delete state.schedules[scheduleId];
    await this.saveState(state);
    await this.scheduleNextAlarm(state);

    return true;
  }

  /**
   * Gets all registered schedules.
   *
   * @returns Map of scheduleId to schedule configuration.
   */
  async getSchedules(): Promise<
    Record<
      string,
      {
        cron: string;
        timezone?: string;
        nextRunAt: number;
        handlerHash: string;
        input?: unknown;
      }
    >
  > {
    const state = await this.loadState();
    return { ...state.schedules };
  }

  /**
   * Returns due schedules and recalculates their next run.
   * Called by the runtime when an alarm fires.
   *
   * @returns Array of due schedule configurations.
   */
  async popDueSchedules(now?: number): Promise<
    Array<{
      scheduleId: string;
      handlerHash: string;
      input?: unknown;
    }>
  > {
    const state = await this.loadState();
    const currentTime = now ?? Date.now();
    const due: Array<{
      scheduleId: string;
      handlerHash: string;
      input?: unknown;
    }> = [];

    // Find and process due schedules
    for (const [scheduleId, schedule] of Object.entries(state.schedules)) {
      if (schedule.nextRunAt <= currentTime) {
        due.push({
          scheduleId,
          handlerHash: schedule.handlerHash,
          input: schedule.input,
        });

        // Recalculate next run
        schedule.nextRunAt = this.calculateNextRun(
          schedule.cron,
          schedule.timezone,
        );
      }
    }

    // Sort by nextRunAt (deterministic ordering)
    const sortedSchedules = Object.entries(state.schedules).sort(
      (a, b) => a[1].nextRunAt - b[1].nextRunAt,
    );

    // Rebuild schedules object in sorted order
    state.schedules = Object.fromEntries(sortedSchedules);

    await this.saveState(state);
    await this.scheduleNextAlarm(state);

    return due;
  }

  /**
   * Processes alarm payloads from the adapter.
   * Maps schedule alarms to their respective handlers.
   *
   * @returns Array of schedule executions to perform.
   */
  async processAlarms(): Promise<
    Array<{
      executionId: string;
      traceId: string;
      wakeReason: string;
      scheduleId?: string;
    }>
  > {
    const alarms = await this.scheduler.popDueAlarms();
    const executions: Array<{
      executionId: string;
      traceId: string;
      wakeReason: string;
      scheduleId?: string;
    }> = [];

    for (const alarm of alarms) {
      if (alarm.wakeReason === "scheduled" && alarm.scheduleId) {
        executions.push(alarm);
      }
    }

    return executions;
  }

  private async loadState(): Promise<ScheduleState> {
    const raw = await this.state.get(this.stateKey);
    return (raw as ScheduleState) ?? { schedules: {} };
  }

  private async saveState(state: ScheduleState): Promise<void> {
    await this.state.set(this.stateKey, state);
  }

  private async scheduleNextAlarm(state: ScheduleState): Promise<void> {
    // Always cancel any existing alarm first
    await this.scheduler.cancelAlarm();

    const nextRun = Math.min(
      ...Object.values(state.schedules).map((s) => s.nextRunAt),
      Infinity,
    );

    if (nextRun !== Infinity) {
      // Find the schedule with earliest nextRunAt
      const [scheduleId] = Object.entries(state.schedules).find(
        ([, s]) => s.nextRunAt === nextRun,
      ) ?? [undefined];

      await this.scheduler.scheduleAlarm(nextRun, {
        executionId: crypto.randomUUID(),
        traceId: crypto.randomUUID(),
        wakeReason: "scheduled",
        scheduleId,
      });
    }
  }

  private calculateNextRun(cron: string, _timezone?: string): number {
    // Placeholder: 1 minute from now
    // In production, use cron-parser with timezone support
    void cron;
    void _timezone;
    return Date.now() + 60000;
  }
}
