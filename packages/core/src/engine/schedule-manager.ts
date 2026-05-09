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

const MINUTE_MS = 60_000;
const MAX_LOOKAHEAD_MINUTES = 5 * 366 * 24 * 60;

interface CronField {
  any: boolean;
  values: Set<number>;
}

interface ParsedCronExpression {
  minute: CronField;
  hour: CronField;
  dayOfMonth: CronField;
  month: CronField;
  dayOfWeek: CronField;
}

interface TimeParts {
  minute: number;
  hour: number;
  dayOfMonth: number;
  month: number;
  dayOfWeek: number;
}

const WEEKDAY_TO_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();
const cronCache = new Map<string, ParsedCronExpression>();

function parseCronField(
  rawField: string,
  min: number,
  max: number,
  fieldName: string,
): CronField {
  const field = rawField.trim();

  if (!field) {
    throw new Error(`Invalid cron: empty ${fieldName} field`);
  }

  if (field === "*") {
    return { any: true, values: new Set<number>() };
  }

  const values = new Set<number>();
  const segments = field.split(",");

  for (const segment of segments) {
    const token = segment.trim();
    if (!token) {
      throw new Error(
        `Invalid cron: malformed ${fieldName} field "${rawField}"`,
      );
    }

    const [basePart, stepPart] = token.split("/");
    if (!basePart) {
      throw new Error(`Invalid cron: malformed ${fieldName} token "${token}"`);
    }

    const step =
      stepPart !== undefined ? Number.parseInt(stepPart, 10) : undefined;

    if (
      stepPart !== undefined &&
      (step === undefined || !Number.isInteger(step) || step <= 0)
    ) {
      throw new Error(
        `Invalid cron: invalid step "${stepPart}" in ${fieldName}`,
      );
    }

    let rangeStart: number;
    let rangeEnd: number;

    if (basePart === "*") {
      rangeStart = min;
      rangeEnd = max;
    } else if (basePart.includes("-")) {
      const [rawStart, rawEnd] = basePart.split("-");
      const start = Number.parseInt(rawStart ?? "", 10);
      const end = Number.parseInt(rawEnd ?? "", 10);
      if (!Number.isInteger(start) || !Number.isInteger(end)) {
        throw new Error(
          `Invalid cron: malformed range "${basePart}" in ${fieldName}`,
        );
      }
      rangeStart = Math.min(start, end);
      rangeEnd = Math.max(start, end);
    } else {
      const value = Number.parseInt(basePart, 10);
      if (!Number.isInteger(value)) {
        throw new Error(
          `Invalid cron: invalid value "${basePart}" in ${fieldName}`,
        );
      }
      rangeStart = value;
      rangeEnd = value;
    }

    if (rangeStart < min || rangeEnd > max) {
      throw new Error(
        `Invalid cron: ${fieldName} value out of range (${min}-${max}) in "${token}"`,
      );
    }

    const increment = step ?? 1;
    for (let value = rangeStart; value <= rangeEnd; value += increment) {
      values.add(value);
    }
  }

  return {
    any: false,
    values,
  };
}

function parseCronExpression(cron: string): ParsedCronExpression {
  const cached = cronCache.get(cron);
  if (cached) {
    return cached;
  }

  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error(
      `Invalid cron: expected 5 fields, received ${parts.length}`,
    );
  }

  const parsed: ParsedCronExpression = {
    minute: parseCronField(parts[0]!, 0, 59, "minute"),
    hour: parseCronField(parts[1]!, 0, 23, "hour"),
    dayOfMonth: parseCronField(parts[2]!, 1, 31, "day-of-month"),
    month: parseCronField(parts[3]!, 1, 12, "month"),
    dayOfWeek: parseCronField(parts[4]!, 0, 7, "day-of-week"),
  };

  // Normalize Sunday aliases (0 and 7)
  if (!parsed.dayOfWeek.any && parsed.dayOfWeek.values.has(7)) {
    parsed.dayOfWeek.values.delete(7);
    parsed.dayOfWeek.values.add(0);
  }

  cronCache.set(cron, parsed);
  return parsed;
}

function getFormatter(timezone: string): Intl.DateTimeFormat {
  const cached = formatterCache.get(timezone);
  if (cached) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hourCycle: "h23",
    minute: "2-digit",
    hour: "2-digit",
    day: "2-digit",
    month: "2-digit",
    weekday: "short",
  });

  formatterCache.set(timezone, formatter);
  return formatter;
}

function getTimeParts(timestamp: number, timezone?: string): TimeParts {
  if (!timezone) {
    const date = new Date(timestamp);
    return {
      minute: date.getUTCMinutes(),
      hour: date.getUTCHours(),
      dayOfMonth: date.getUTCDate(),
      month: date.getUTCMonth() + 1,
      dayOfWeek: date.getUTCDay(),
    };
  }

  const formatter = getFormatter(timezone);
  const parts = formatter.formatToParts(new Date(timestamp));
  const values = new Map<string, string>();
  for (const part of parts) {
    values.set(part.type, part.value);
  }

  const weekday = values.get("weekday");
  const dayOfWeek = weekday ? WEEKDAY_TO_INDEX[weekday] : undefined;

  if (dayOfWeek === undefined) {
    throw new Error(`Unable to resolve weekday for timezone "${timezone}"`);
  }

  return {
    minute: Number.parseInt(values.get("minute") ?? "", 10),
    hour: Number.parseInt(values.get("hour") ?? "", 10),
    dayOfMonth: Number.parseInt(values.get("day") ?? "", 10),
    month: Number.parseInt(values.get("month") ?? "", 10),
    dayOfWeek,
  };
}

function matchesCron(
  cron: ParsedCronExpression,
  timeParts: TimeParts,
): boolean {
  if (!cron.minute.any && !cron.minute.values.has(timeParts.minute)) {
    return false;
  }

  if (!cron.hour.any && !cron.hour.values.has(timeParts.hour)) {
    return false;
  }

  if (!cron.month.any && !cron.month.values.has(timeParts.month)) {
    return false;
  }

  const dayOfMonthMatch =
    cron.dayOfMonth.any || cron.dayOfMonth.values.has(timeParts.dayOfMonth);
  const dayOfWeekMatch =
    cron.dayOfWeek.any || cron.dayOfWeek.values.has(timeParts.dayOfWeek);

  // POSIX/Vixie cron semantics:
  // - if both DOM and DOW are explicit, either match is enough
  // - otherwise, the non-wildcard field drives the constraint
  if (!cron.dayOfMonth.any && !cron.dayOfWeek.any) {
    return dayOfMonthMatch || dayOfWeekMatch;
  }

  return dayOfMonthMatch && dayOfWeekMatch;
}

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
          currentTime,
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

  private calculateNextRun(
    cron: string,
    timezone?: string,
    baseTime?: number,
  ): number {
    const parsedCron = parseCronExpression(cron);
    const startFrom = baseTime ?? Date.now();
    const nextMinuteStart =
      Math.floor(startFrom / MINUTE_MS) * MINUTE_MS + MINUTE_MS;

    for (let i = 0; i < MAX_LOOKAHEAD_MINUTES; i++) {
      const candidate = nextMinuteStart + i * MINUTE_MS;
      const timeParts = getTimeParts(candidate, timezone);
      if (matchesCron(parsedCron, timeParts)) {
        return candidate;
      }
    }

    throw new Error(
      `Unable to compute next run for cron "${cron}" within ${MAX_LOOKAHEAD_MINUTES} minutes`,
    );
  }
}
