import { createSignal } from "@kalphq/sdk";
import { z } from "zod";

/**
 * Signal sent when a task completes successfully
 */
export const taskComplete = createSignal({
  id: "task_complete",
  input: z.object({
    taskId: z.string(),
    result: z.string(),
    duration: z.number(), // seconds
  }),
  async handler({ taskId, result, duration }) {
    // Signal completion to orchestrator
    // In real implementation, update task queue

    return {
      acknowledged: true,
      taskId,
      status: "completed",
      duration,
    };
  },
});
