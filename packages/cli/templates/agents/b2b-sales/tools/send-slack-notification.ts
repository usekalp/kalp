import { createTool } from "@kalphq/sdk";
import { z } from "zod";

export const sendSlackNotification = createTool({
  id: "send_slack_notification",
  description: "Sends a notification to Slack channel for hot leads.",
  input: z.object({
    company: z.string(),
    score: z.number(),
    domain: z.string(),
    channel: z.string().default("#sales-hot-leads"),
  }),
  async execute({ company, score, domain, channel }, ctx) {
    ctx.logger.info("Sending Slack notification", { company, score, channel });

    // Replace with actual Slack API call using webhook or bot token
    // Example: await fetch("https://hooks.slack.com/services/...", {...})

    return {
      sent: true,
      channel,
      message: `🔥 Hot Lead Alert: ${company} (${domain}) scored ${score}/100`,
      timestamp: new Date().toISOString(),
    };
  },
});
