/**
 * Schedules namespace — operations on scheduled tasks.
 *
 * Behavioral invariants:
 * - cancel() rejects if task doesn't exist or is already terminal
 * - reschedule() rejects if task doesn't exist or is already terminal
 * - status() returns current state of the scheduled task
 *
 * @module
 */

export type ScheduleStatus =
  | "scheduled"
  | "running"
  | "completed"
  | "cancelled"
  | "failed";

export interface KalpSchedules {
  cancel(id: string): Promise<void>;
  reschedule(id: string, when: Date | number): Promise<void>;
  status(id: string): Promise<ScheduleStatus>;
}
