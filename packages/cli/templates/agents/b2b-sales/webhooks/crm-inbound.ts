import { defineWebhook } from "@kalphq/sdk";
import { z } from "zod";

/**
 * Inbound webhook to receive new lead events from CRM (HubSpot, Salesforce, etc.)
 */
export const crmInbound = defineWebhook({
  id: "crm_inbound",
  input: z.object({
    leadId: z.string(),
    email: z.string().email(),
    company: z.string(),
    source: z.string(),
    metadata: z.record(z.unknown()).optional(),
  }),
  async handler({ leadId, email, company, source }) {
    // Process new lead from CRM
    // In real implementation, this would trigger agent processing
    return {
      success: true,
      message: "Lead received",
      leadId,
      company,
      source,
    };
  },
});
