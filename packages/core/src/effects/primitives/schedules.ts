import type { KalpSchedules, ScheduleStatus } from "@kalphq/sdk";
import type { EffectInterceptor } from "./types";

/**
 * Create the schedules primitive for managing scheduled actions.
 * Provides cancel, reschedule, and status operations against previously created schedules.
 *
 * @param interceptEffect - Effect interceptor for routing schedule operations through the effect pipeline.
 */
export function createSchedulesContext(interceptEffect: EffectInterceptor): KalpSchedules {
  return {
    cancel: (id: string) =>
      interceptEffect("action.schedule.cancel", { id }),
    reschedule: (id: string, when: Date | number) =>
      interceptEffect("action.schedule.reschedule", {
        id,
        when: when instanceof Date ? when.getTime() : when,
      }),
    status: (id: string) =>
      interceptEffect("action.schedule.status", { id }) as Promise<ScheduleStatus>,
  };
}
