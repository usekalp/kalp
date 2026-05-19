import { describe, it, expect } from "vitest";
import { parseCronExpression } from "../../src/engine/cron-parser";

describe("parseCronExpression", () => {
  it("should parse wildcard expression", () => {
    const result = parseCronExpression("* * * * *");
    expect(result.minute.any).toBe(true);
    expect(result.hour.any).toBe(true);
    expect(result.dayOfMonth.any).toBe(true);
    expect(result.month.any).toBe(true);
    expect(result.dayOfWeek.any).toBe(true);
  });

  it("should parse a single value", () => {
    const result = parseCronExpression("30 * * * *");
    expect(result.minute.any).toBe(false);
    expect([...result.minute.values]).toEqual([30]);
    expect(result.hour.any).toBe(true);
  });

  it("should parse a range", () => {
    const result = parseCronExpression("1-5 * * * *");
    expect(result.minute.any).toBe(false);
    expect([...result.minute.values]).toEqual([1, 2, 3, 4, 5]);
  });

  it("should parse step values with wildcard", () => {
    const result = parseCronExpression("*/5 * * * *");
    expect(result.minute.any).toBe(false);
    expect([...result.minute.values]).toEqual([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]);
  });

  it("should parse step values with range", () => {
    const result = parseCronExpression("1-10/2 * * * *");
    expect(result.minute.any).toBe(false);
    expect([...result.minute.values]).toEqual([1, 3, 5, 7, 9]);
  });

  it("should normalize Sunday 7 to 0", () => {
    const result = parseCronExpression("0 0 * * 7");
    expect(result.dayOfWeek.any).toBe(false);
    expect([...result.dayOfWeek.values]).toEqual([0]);
  });

  it("should return cached result for repeated expressions", () => {
    const first = parseCronExpression("30 * * * *");
    const second = parseCronExpression("30 * * * *");
    expect(first).toBe(second);
  });

  it("should throw for wrong number of fields (too few)", () => {
    expect(() => parseCronExpression("* * * *")).toThrow(
      "Invalid cron: expected 5 fields, received 4",
    );
  });

  it("should throw for wrong number of fields (too many)", () => {
    expect(() => parseCronExpression("* * * * * *")).toThrow(
      "Invalid cron: expected 5 fields, received 6",
    );
  });

  it("should throw for empty field segment", () => {
    expect(() => parseCronExpression("30, * * * *")).toThrow(
      "Invalid cron: malformed minute field",
    );
  });

  it("should throw for non-integer range boundary", () => {
    expect(() => parseCronExpression("a-b * * * *")).toThrow(
      "Invalid cron: malformed range",
    );
  });

  it("should throw for out-of-range minute value", () => {
    expect(() => parseCronExpression("60 * * * *")).toThrow(
      "Invalid cron: minute value out of range",
    );
  });

  it("should throw for out-of-range hour value", () => {
    expect(() => parseCronExpression("* 24 * * *")).toThrow(
      "Invalid cron: hour value out of range",
    );
  });

  it("should throw for out-of-range day-of-month value", () => {
    expect(() => parseCronExpression("* * 32 * *")).toThrow(
      "Invalid cron: day-of-month value out of range",
    );
  });

  it("should throw for out-of-range month value", () => {
    expect(() => parseCronExpression("* * * 13 *")).toThrow(
      "Invalid cron: month value out of range",
    );
  });

  it("should throw for out-of-range day-of-week value", () => {
    expect(() => parseCronExpression("* * * * 8")).toThrow(
      "Invalid cron: day-of-week value out of range",
    );
  });

  it("should parse multiple comma-separated values", () => {
    const result = parseCronExpression("0,15,30,45 * * * *");
    expect(result.minute.any).toBe(false);
    expect([...result.minute.values]).toEqual([0, 15, 30, 45]);
  });
});