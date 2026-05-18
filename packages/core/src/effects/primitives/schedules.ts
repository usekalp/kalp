import type { KalpSchedules, ScheduleStatus } from "@kalphq/sdk";
import type { EffectInterceptor } from "./types";

export function createSchedulesContext(interceptEffect: EffectInterceptor): KalpSchedules {
  return {
    cancel: (id: string) =>
      interceptEffect("action.schedule.cancel", { id }) as Promise<void>,
    reschedule: (id: string, when: Date | number) =>
      interceptEffect("action.schedule.reschedule", { id, when: when instanceof Date ? when.getTime() : when }) as Promise<void>,
    status: (id: string) =>
      interceptEffect("action.schedule.status", { id }) as Promise<ScheduleStatus>,
  };
}
