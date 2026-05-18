/**
 * schedule() — schedule a task for future execution.
 *
 * Schedules an ExecutableNode (Tool, Route, etc.) to run at a future time.
 * Returns a ScheduledTask with an id for later management.
 *
 * Behavioral invariants:
 * - Returns { id } — no live object handles
 * - Use ctx.schedules.cancel(id) to cancel
 * - Use ctx.schedules.reschedule(id, when) to reschedule
 * - Use ctx.schedules.status(id) to check status
 *
 * @module
 */

import type { ExecutableNode } from "@/nodes/types";
import type { InputOf } from "@/utils/types";
import type { Duration } from "@/primitives/duration";

export interface ScheduledTask {
  id: string;
}

export type TimestampInput = Date | number;

export type ScheduleAction = <T extends ExecutableNode>(
  node: T,
  when: TimestampInput | Duration,
  ...args: InputOf<T> extends never ? [] : [input: InputOf<T>]
) => Promise<ScheduledTask>;
