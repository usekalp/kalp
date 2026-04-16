import { defineWebhook } from "@kalphq/sdk";
import { z } from "zod";

/**
 * Zendesk ticket sync webhook
 */
export const zendeskTicket = defineWebhook({
  id: "zendesk_ticket",
  input: z.object({
    ticketId: z.string(),
    status: z.string(), // "new", "open", "pending", "solved", "closed"
    subject: z.string(),
    requesterEmail: z.string(),
    tags: z.array(z.string()),
    customFields: z.record(z.unknown()).optional(),
  }),
  async handler({ ticketId, status, subject, requesterEmail, tags, customFields }) {
    // Sync external Zendesk ticket with internal system
    // In real implementation, update internal ticket store

    return {
      synced: true,
      externalId: ticketId,
      localId: `LOCAL-${ticketId}`,
      status,
      tags,
    };
  },
});
