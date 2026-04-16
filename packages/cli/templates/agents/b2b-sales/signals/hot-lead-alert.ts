import { createSignal } from "@kalphq/sdk";
import { z } from "zod";

/**
 * Signal broadcast when a hot lead is identified
 */
export const hotLeadAlert = createSignal({
  id: "hot_lead_alert",
  input: z.object({
    leadId: z.string(),
    company: z.string(),
    score: z.number(),
    email: z.string(),
    priority: z.string(), // "high", "medium", "low"
    qualified: z.boolean(),
  }),
  async handler({ leadId, company, score, email, priority, qualified }) {
    // Signal received by other agents (SalesManager, NotificationAgent, etc.)
    // In real implementation, this would trigger notifications
    return {
      acknowledged: true,
      leadId,
      company,
      score,
      priority,
      qualified,
    };
  },
});
