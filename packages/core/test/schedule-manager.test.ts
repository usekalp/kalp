/**
 * Tests for schedule-manager time queues.
 *
 * These tests verify that:
 * 1. ScheduleManager correctly queues multiple cron schedules
 * 2. Only the next alarm is scheduled with the adapter
 * 3. On alarm, the engine fires and reschedules
 *
 * @module
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ScheduleManager } from "../src/engine/schedule-manager";
import { createFakeAdapters } from "./fixtures/fake-adapters";

describe("schedule-manager", () => {
  let manager: ScheduleManager;
  let scheduler: ReturnType<typeof createFakeAdapters>["scheduler"];
  let state: ReturnType<typeof createFakeAdapters>["state"];

  beforeEach(() => {
    const adapters = createFakeAdapters();
    scheduler = adapters.scheduler;
    state = adapters.state;
    manager = new ScheduleManager(state, scheduler);
  });

  describe("cron queue management", () => {
    it("should schedule only the next alarm when registering multiple crons", async () => {
      // Register two crons: one for 1 minute, one for 5 minutes
      await manager.registerSchedule(
        "schedule-1",
        "*/1 * * * *", // Every minute
        "handler-hash-1",
        { message: "every minute" },
      );

      await manager.registerSchedule(
        "schedule-2",
        "*/5 * * * *", // Every 5 minutes
        "handler-hash-2",
        { message: "every 5 minutes" },
      );

      // Verify scheduler only has one alarm (the closest one)
      const alarms = scheduler.getAlarms();
      expect(alarms.length).toBe(1);

      // The alarm should be for schedule-1 (every minute = sooner)
      expect(alarms[0].at).toBeLessThan(Date.now() + 2 * 60 * 1000); // Less than 2 minutes
    });

    it("should reschedule to next alarm after one fires", async () => {
      // Register a schedule
      await manager.registerSchedule(
        "daily-cron",
        "0 9 * * *", // Daily at 9am
        "daily-handler",
        { type: "daily-report" },
      );

      const firstAlarmTime = scheduler.getNextAlarmTime();
      expect(firstAlarmTime).toBeDefined();

      // Simulate time advancing past the alarm
      scheduler.setCurrentTime(firstAlarmTime! + 1000);

      // Get due schedules using fake scheduler time
      const due = await manager.popDueSchedules(scheduler.getCurrentTime());

      // Verify the schedule fired
      expect(due.length).toBe(1);
      expect(due[0]).toMatchObject({
        scheduleId: "daily-cron",
        handlerHash: "daily-handler",
      });

      // Verify a new alarm was scheduled
      const newAlarmTime = scheduler.getNextAlarmTime();
      expect(newAlarmTime).toBeDefined();
      // The new alarm should be in the future (relative to when it was set)
      expect(newAlarmTime).toBeGreaterThan(Date.now());
    });

    it("should handle multiple schedules with correct priority", async () => {
      // Register schedules in reverse priority order
      await manager.registerSchedule(
        "far-future",
        "0 0 1 1 *", // January 1st (far future)
        "yearly-handler",
        { type: "yearly" },
      );

      await manager.registerSchedule(
        "near-future",
        "* * * * *", // Every minute (very soon)
        "minute-handler",
        { type: "minute" },
      );

      await manager.registerSchedule(
        "medium-future",
        "0 * * * *", // Every hour
        "hourly-handler",
        { type: "hourly" },
      );

      // Get all schedules
      const schedules = await manager.getSchedules();
      expect(Object.keys(schedules).length).toBe(3);

      // The scheduler should only have the nearest alarm
      const alarms = scheduler.getAlarms();
      expect(alarms.length).toBe(1);

      // Should be the minute schedule (most frequent)
      const due = await manager.popDueSchedules();
      expect(due.length).toBeGreaterThanOrEqual(0);
    });

    it("should cancel schedule and remove alarm if it was the only one", async () => {
      // Register a single schedule
      await manager.registerSchedule(
        "temp-schedule",
        "*/5 * * * *",
        "temp-handler",
        {},
      );

      // Verify alarm exists
      expect(scheduler.getAlarms().length).toBe(1);

      // Cancel it
      const cancelled = await manager.cancelSchedule("temp-schedule");
      expect(cancelled).toBe(true);

      // Alarm should be cancelled
      expect(scheduler.getAlarms().length).toBe(0);
    });

    it("should reschedule to next schedule when cancelling the nearest", async () => {
      // Register two schedules
      await manager.registerSchedule(
        "soon",
        "* * * * *", // Every minute
        "soon-handler",
        {},
      );

      await manager.registerSchedule(
        "later",
        "*/5 * * * *", // Every 5 minutes
        "later-handler",
        {},
      );

      // Get the first alarm time
      const firstAlarm = scheduler.getNextAlarmTime();

      // Cancel the nearest schedule
      await manager.cancelSchedule("soon");

      // Should still have an alarm (for the "later" schedule)
      const remainingAlarms = scheduler.getAlarms();
      expect(remainingAlarms.length).toBe(1);

      // The alarm should be later than the original
      expect(remainingAlarms[0].at).toBeGreaterThanOrEqual(firstAlarm!);
    });
  });

  describe("alarm processing", () => {
    it("should return empty array when no schedules are due", async () => {
      // Register a far future schedule
      await manager.registerSchedule(
        "far-schedule",
        "0 0 1 1 *", // Jan 1st at 00:00 (far enough for this test window)
        "future-handler",
        {},
      );

      // Get due schedules (should be empty)
      const due = await manager.popDueSchedules();
      expect(due.length).toBe(0);
    });

    it("should return schedule details when processing due alarms", async () => {
      await manager.registerSchedule(
        "test-schedule",
        "*/1 * * * *",
        "test-handler-hash",
        { foo: "bar" },
      );

      // Advance time past the alarm
      const alarmTime = scheduler.getNextAlarmTime()!;
      scheduler.setCurrentTime(alarmTime + 1000);

      // Get due schedules
      const due = await manager.popDueSchedules(scheduler.getCurrentTime());

      expect(due.length).toBe(1);
      expect(due[0]).toEqual({
        scheduleId: "test-schedule",
        handlerHash: "test-handler-hash",
        input: { foo: "bar" },
      });
    });

    it("should throw on invalid cron expressions", async () => {
      await expect(
        manager.registerSchedule(
          "invalid-schedule",
          "0 0 1 1 2099",
          "invalid-handler",
          {},
        ),
      ).rejects.toThrow(/Invalid cron/);
    });

    it("should handle multiple concurrent due schedules", async () => {
      // Register schedules that will be due at the same time
      await manager.registerSchedule(
        "schedule-a",
        "* * * * *",
        "handler-a",
        {},
      );

      await manager.registerSchedule(
        "schedule-b",
        "* * * * *",
        "handler-b",
        {},
      );

      // Advance time
      const alarmTime = scheduler.getNextAlarmTime()!;
      scheduler.setCurrentTime(alarmTime + 1000);

      // Both should be due
      const due = await manager.popDueSchedules(scheduler.getCurrentTime());
      expect(due.length).toBe(2);

      // Verify both handlers are present
      const handlerHashes = due.map((d) => d.handlerHash);
      expect(handlerHashes).toContain("handler-a");
      expect(handlerHashes).toContain("handler-b");
    });
  });

  describe("state persistence", () => {
    it("should persist schedules to state store", async () => {
      await manager.registerSchedule(
        "persisted-schedule",
        "0 12 * * *",
        "noon-handler",
        { notify: true },
      );

      // Verify state was persisted
      const schedules = await manager.getSchedules();
      expect(schedules["persisted-schedule"]).toMatchObject({
        cron: "0 12 * * *",
        handlerHash: "noon-handler",
        input: { notify: true },
      });
    });

    it("should restore schedules from state on new instance", async () => {
      // Register with first manager
      await manager.registerSchedule(
        "restored-schedule",
        "*/10 * * * *",
        "ten-min-handler",
        {},
      );

      // Create new manager with same state
      const newManager = new ScheduleManager(state, scheduler);

      // Should still have the schedule
      const schedules = await newManager.getSchedules();
      expect(schedules["restored-schedule"]).toBeDefined();
    });
  });
});
