import type { StateStore, SchedulerAdapter } from "@/adapters/interfaces";
import { calculateNextOccurrence } from "./cron-utils";

/**
 * Schedule state persisted in the State Store.
 * 
 * Each schedule entry contains the cron expression, target handler, 
 * and the pre-calculated next run time for O(1) lookup.
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
 * The Schedule Manager for the Kalp Runtime.
 *
 * It orchestrates multiple concurrent cron schedules within a single agent thread.
 * 
 * Key Architecture:
 * 1. The Core manages the logical queue of all schedules in the `StateStore`.
 * 2. The Host Adapter only manages a single "physical" alarm (via `scheduleAlarm`).
 * 3. On wake-up, the Core processes all due schedules and calculates the next alarm time.
 *
 * @module
 */
export class ScheduleManager {
  /** Internal key used to persist the schedule state in KV. */
  private readonly stateKey = "__kalp_schedules__";

  /**
   * Initializes the schedule manager.
   * 
   * @param state - The KV state store for persistence.
   * @param scheduler - The host adapter for setting physical timers/alarms.
   */
  constructor(
    private readonly state: StateStore,
    private readonly scheduler: SchedulerAdapter,
  ) {}

  /**
   * Registers a new cron schedule.
   * 
   * If a schedule with the same ID already exists, it is overwritten.
   * The manager automatically updates the physical alarm if this new schedule is the next due.
   *
   * @param scheduleId - A unique identifier for the schedule.
   * @param cron - A standard 5-field cron expression.
   * @param handlerHash - The hash of the handler bundle to execute.
   * @param input - Optional payload to pass to the handler.
   * @param timezone - Optional timezone for cron evaluation (defaults to UTC).
   * @returns The timestamp of the first scheduled run.
   */
  async registerSchedule(
    scheduleId: string,
    cron: string,
    handlerHash: string,
    input?: unknown,
    timezone?: string,
  ): Promise<number> {
    const state = await this.loadState();
    
    // Calculate the first run time starting from now
    const nextRunAt = calculateNextOccurrence(cron, Date.now(), timezone);

    state.schedules[scheduleId] = {
      cron,
      timezone,
      nextRunAt,
      handlerHash,
      input,
    };

    await this.saveState(state);
    await this.updatePhysicalAlarm(state);

    return nextRunAt;
  }

  /**
   * Cancels an existing schedule.
   * 
   * @param scheduleId - The identifier of the schedule to remove.
   * @returns True if the schedule was found and removed, false otherwise.
   */
  async cancelSchedule(scheduleId: string): Promise<boolean> {
    const state = await this.loadState();
    if (!state.schedules[scheduleId]) return false;

    delete state.schedules[scheduleId];
    await this.saveState(state);
    await this.updatePhysicalAlarm(state);

    return true;
  }

  /**
   * Identifies and returns all schedules that are due (or overdue) at the given time.
   * 
   * For each due schedule:
   * 1. It is returned in the list.
   * 2. Its `nextRunAt` is automatically rescheduled to the next occurrence.
   * 
   * After processing, the physical alarm is updated for the next future event.
   *
   * @param now - The current reference timestamp (defaults to Date.now()).
   * @returns A list of due schedules ready for execution.
   */
  async popDueSchedules(now: number = Date.now()): Promise<Array<{
    scheduleId: string;
    handlerHash: string;
    input?: unknown;
  }>> {
    const state = await this.loadState();
    const due: Array<{ scheduleId: string; handlerHash: string; input?: unknown }> = [];
    let stateChanged = false;

    for (const [id, schedule] of Object.entries(state.schedules)) {
      if (schedule.nextRunAt <= now) {
        due.push({
          scheduleId: id,
          handlerHash: schedule.handlerHash,
          input: schedule.input,
        });

        // Reschedule to next occurrence
        schedule.nextRunAt = calculateNextOccurrence(schedule.cron, now, schedule.timezone);
        stateChanged = true;
      }
    }

    if (stateChanged) {
      await this.saveState(state);
    }

    // Always ensure the physical alarm matches the next logical due date
    await this.updatePhysicalAlarm(state);

    return due;
  }

  /**
   * Returns a read-only snapshot of all registered schedules.
   */
  async getSchedules(): Promise<ScheduleState["schedules"]> {
    const state = await this.loadState();
    return { ...state.schedules };
  }

  /**
   * Internal: Syncs the host's physical alarm with the next logical due date in the queue.
   */
  private async updatePhysicalAlarm(state: ScheduleState): Promise<void> {
    const schedules = Object.values(state.schedules);
    if (schedules.length === 0) {
      // Clear host alarms if no schedules left
      if (this.scheduler.cancelAlarm) {
          await this.scheduler.cancelAlarm();
      }
      return;
    }

    // Find the nearest future run time
    const nextDue = Math.min(...schedules.map((s) => s.nextRunAt));

    // Schedule the alarm in the host (Cloudflare, etc.)
    await this.scheduler.scheduleAlarm(nextDue, {
      executionId: crypto.randomUUID(),
      traceId: "system-timer",
      wakeReason: "cron-wake",
    });
  }

  private async loadState(): Promise<ScheduleState> {
    const raw = await this.state.get(this.stateKey);
    if (!raw || typeof raw !== "object") {
      return { schedules: {} };
    }
    return raw as ScheduleState;
  }

  private async saveState(state: ScheduleState): Promise<void> {
    await this.state.set(this.stateKey, state);
  }
}
