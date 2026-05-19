import { describe, it, expect } from "vitest";
import { createTimeContext } from "../../src/effects/primitives/time";

describe("createTimeContext", () => {
  const baseTime = 1700000000000;
  const time = createTimeContext(baseTime);

  it("should return base time from now()", () => {
    expect(time.now()).toBe(baseTime);
  });

  it("should format ISO string", () => {
    expect(time.toISOString()).toBe(new Date(baseTime).toISOString());
  });

  it("should format ISO string with custom timestamp", () => {
    const custom = baseTime + 1000;
    expect(time.toISOString(custom)).toBe(new Date(custom).toISOString());
  });

  it("should compare isAfter / isBefore", () => {
    const later = new Date(baseTime + 1000).toISOString();
    const earlier = new Date(baseTime - 1000).toISOString();
    expect(time.isAfter(earlier)).toBe(true);
    expect(time.isAfter(later)).toBe(false);
    expect(time.isBefore(later)).toBe(true);
    expect(time.isBefore(earlier)).toBe(false);
  });

  it("should add duration", () => {
    const result = time.add({ hours: 1 });
    expect(result).toBe(baseTime + 3600000);
  });

  it("should sub duration", () => {
    const result = time.sub({ days: 1 });
    expect(result).toBe(baseTime - 86400000);
  });

  it("should provide timezone formatter with UTC", () => {
    const tz = time.timezone("UTC");
    expect(tz.toISOString()).toBe(new Date(baseTime).toISOString());
    expect(tz.format("YYYY")).toBe("2023");
  });

  it("should format timezone with multiple tokens", () => {
    const tz = time.timezone("UTC");
    const formatted = tz.format("YYYY-MM-DD HH:mm:ss");
    expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it("should provide toISOString for non-UTC timezone", () => {
    const tz = time.timezone("America/New_York");
    const result = tz.toISOString();
    expect(typeof result).toBe("string");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
  });

  it("should format non-UTC timezone with tokens", () => {
    const tz = time.timezone("America/New_York");
    const formatted = tz.format("HH:mm");
    expect(formatted).toMatch(/^\d{2}:\d{2}$/);
  });

  it("should format with MM and DD tokens", () => {
    const tz = time.timezone("UTC");
    expect(tz.format("YYYY-MM-DD")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
