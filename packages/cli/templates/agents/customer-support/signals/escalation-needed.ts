import { createSignal } from "@kalphq/sdk";
import { z } from "zod";

/**
 * Signal to alert senior support agents about escalation
 */
export const escalationNeeded = createSignal({
  id: "escalation_needed",
  input: z.object({
    ticketId: z.string(),
    customerId: z.string(),
    issue: z.string(),
    priority: z.string(),
    previousAttempts: z.number(),
    sentiment: z.string(),
  }),
  async handler({ ticketId, customerId, issue, priority, previousAttempts, sentiment }) {
    // Signal received by senior support agents
    // In real implementation, this triggers notifications

    return {
      received: true,
      ticketId,
      assignedTier: priority === "high" ? "tier3" : "tier2",
      estimatedHandleTime: priority === "high" ? "15 min" : "1 hour",
    };
  },
});
