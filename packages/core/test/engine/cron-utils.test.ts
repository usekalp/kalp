import { describe, it, expect, vi } from "vitest";
import { parseCronExpression } from "../../src/engine/cron-parser";
import {
  getTimeParts,
  matchesCron,
  calculateNextOccurrence,
} from "../../src/engine/cron-utils";

describe("matchesCron", () => {
  it("should return false on minute mismatch", () => {
    const cron = parseCronExpression("30 * * * *");
    const result = matchesCron(cron, {
      minute: 0,
      hour: 0,
      dayOfMonth: 1,
      month: 1,
      dayOfWeek: 0,
    });
    expect(result).toBe(false);
  });

  it("should return false on hour mismatch", () => {
    const cron = parseCronExpression("* 5 * * *");
    const result = matchesCron(cron, {
      minute: 0,
      hour: 10,
      dayOfMonth: 1,
      month: 1,
      dayOfWeek: 0,
    });
    expect(result).toBe(false);
  });

  it("should return false on month mismatch", () => {
    const cron = parseCronExpression("* * * 6 *");
    const result = matchesCron(cron, {
      minute: 0,
      hour: 0,
      dayOfMonth: 1,
      month: 1,
      dayOfWeek: 0,
    });
    expect(result).toBe(false);
  });

  it("should use OR semantics when both DOM and DOW are specified", () => {
    const cron = parseCronExpression("* * 15 * 0");
    const parts = {
      minute: 0,
      hour: 0,
      dayOfMonth: 10,
      month: 1,
      dayOfWeek: 0,
    };
    expect(matchesCron(cron, parts)).toBe(true);
  });

  it("should use AND semantics when only DOW is specified", () => {
    const cron = parseCronExpression("* * * * 0");
    const parts = {
      minute: 0,
      hour: 0,
      dayOfMonth: 15,
      month: 1,
      dayOfWeek: 0,
    };
    expect(matchesCron(cron, parts)).toBe(true);
  });

  it("should return true when all fields match", () => {
    const cron = parseCronExpression("30 5 * * *");
    const result = matchesCron(cron, {
      minute: 30,
      hour: 5,
      dayOfMonth: 1,
      month: 1,
      dayOfWeek: 0,
    });
    expect(result).toBe(true);
  });
});

describe("getTimeParts", () => {
  it("should return UTC parts when no timezone", () => {
    const ts = Date.UTC(2024, 0, 15, 10, 30, 0);
    const parts = getTimeParts(ts);
    expect(parts.minute).toBe(30);
    expect(parts.hour).toBe(10);
    expect(parts.dayOfMonth).toBe(15);
    expect(parts.month).toBe(1);
    expect(parts.dayOfWeek).toBe(1);
  });

  it("should return timezone-adjusted parts", () => {
    const ts = Date.UTC(2024, 5, 15, 5, 0, 0);
    const parts = getTimeParts(ts, "America/New_York");
    expect(parts.hour).toBe(1);
    expect(parts.minute).toBe(0);
    expect(parts.dayOfMonth).toBe(15);
    expect(parts.month).toBe(6);
  });

  it("should throw when weekday cannot be resolved for timezone", () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, "formatToParts").mockReturnValueOnce([
      { type: "minute", value: "30" },
      { type: "hour", value: "12" },
      { type: "day", value: "15" },
      { type: "month", value: "06" },
    ]);
    expect(() => getTimeParts(1000000, "America/New_York")).toThrow(
      'Unable to resolve weekday for timezone "America/New_York"',
    );
  });
});

describe("calculateNextOccurrence", () => {
  it("should find next matching minute", () => {
    const ts = Date.UTC(2024, 0, 1, 0, 0, 0);
    const result = calculateNextOccurrence("30 * * * *", ts);
    expect(result).toBe(ts + 30 * 60 * 1000);
  });

it("should calculate next occurrence with timezone", () => {
    const ts = Date.UTC(2024, 5, 14, 0, 0, 0);
    const result = calculateNextOccurrence("0 0 * * *", ts, "America/New_York");
    expect(result).toBe(Date.UTC(2024, 5, 14, 4, 0, 0));
  });

  it("should throw when no match within lookahead window", () => {
    expect(() => calculateNextOccurrence("0 0 30 2 *", Date.UTC(2024, 0, 1, 0, 0, 0))).toThrow(
      'Unable to find next occurrence for cron "0 0 30 2 *" within lookahead window.',
    );
  });
});