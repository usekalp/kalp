/**
 * Schedules client — runtime adapter for schedule operations.
 *
 * This module provides the interface between the SDK's schedule types
 * and the actual runtime implementation. The runtime injects the actual
 * implementations at context creation time.
 *
 * @module
 */

import type { KalpSchedules, ScheduleStatus } from "./types";

/**
 * Create a KalpSchedules instance from runtime-provided functions.
 */
export function createSchedulesClient(ops: {
  cancel: (id: string) => Promise<void>;
  reschedule: (id: string, when: Date | number) => Promise<void>;
  status: (id: string) => Promise<ScheduleStatus>;
}): KalpSchedules {
  return {
    cancel: ops.cancel,
    reschedule: ops.reschedule,
    status: ops.status,
  };
}
