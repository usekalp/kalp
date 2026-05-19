import { describe, it, expect } from "vitest";
import { createSchedulesContext } from "../../src/effects/primitives/schedules";
import { createInterceptorMock } from "../helpers/interceptor-mock";

describe("createSchedulesContext", () => {
  it("should cancel via action.schedule.cancel", async () => {
    const { interceptEffect, calls } = createInterceptorMock();
    const schedules = createSchedulesContext(interceptEffect);
    await schedules.cancel("schedule-1");
    expect(calls[0]).toMatchObject({
      type: "action.schedule.cancel",
      payload: { id: "schedule-1" },
    });
  });

  it("should reschedule via action.schedule.reschedule", async () => {
    const { interceptEffect, calls } = createInterceptorMock();
    const schedules = createSchedulesContext(interceptEffect);
    await schedules.reschedule("schedule-1", new Date("2025-01-01"));
    expect(calls[0]).toMatchObject({
      type: "action.schedule.reschedule",
      payload: { id: "schedule-1", when: new Date("2025-01-01").getTime() },
    });
  });

  it("should status via action.schedule.status", async () => {
    const { interceptEffect, calls } = createInterceptorMock({
      "action.schedule.status": () => "active",
    });
    const schedules = createSchedulesContext(interceptEffect);
    const status = await schedules.status("schedule-1");
    expect(calls[0]).toMatchObject({
      type: "action.schedule.status",
      payload: { id: "schedule-1" },
    });
    expect(status).toBe("active");
  });
});
