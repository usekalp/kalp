import { defineWebhook } from "@kalphq/sdk";
import { z } from "zod";

/**
 * Webhook for Slack /escalate command or button
 */
export const slackEscalation = defineWebhook({
  id: "slack_escalation",
  input: z.object({
    userId: z.string(),
    channelId: z.string(),
    ticketId: z.string(),
    reason: z.string(),
    urgency: z.string(), // "low", "medium", "high"
  }),
  async handler({ userId, channelId, ticketId, reason, urgency }) {
    // Process escalation request from Slack
    // In real implementation, notify on-call support

    return {
      acknowledged: true,
      ticketId,
      escalationId: `ESC-${Date.now()}`,
      estimatedResponse: urgency === "high" ? "5 minutes" : "30 minutes",
    };
  },
});
