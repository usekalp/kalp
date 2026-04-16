import { createTool } from "@kalphq/sdk";
import { z } from "zod";

export const sendEmailAlert = createTool({
  id: "send_email_alert",
  description: "Sends email notifications for significant portfolio events.",
  input: z.object({
    to: z.string(),
    subject: z.string(),
    alertType: z.string(), // "price_movement", "rebalance_needed", "dividend", "risk_alert"
    data: z.record(z.unknown()),
  }),
  async execute({ to, subject, alertType, data }) {
    // In real implementation, integrate with SendGrid, AWS SES, etc.

    const emailBody = JSON.stringify({
      alertType,
      timestamp: new Date().toISOString(),
      data,
    }, null, 2);

    return {
      sent: true,
      recipient: to,
      subject,
      alertType,
      messageId: `msg_${Date.now()}`,
      preview: emailBody.slice(0, 200),
    };
  },
});
