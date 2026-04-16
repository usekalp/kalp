import { defineWebhook } from "@kalphq/sdk";
import { z } from "zod";

/**
 * Generic inbound webhook example
 */
export const genericInbound = defineWebhook({
  id: "generic_inbound",
  input: z.object({
    event: z.string(),
    payload: z.record(z.unknown()),
    timestamp: z.string().optional(),
  }),
  async handler({ event, payload, timestamp }) {
    // Process generic inbound webhook
    // In real implementation, route to appropriate handler

    return {
      received: true,
      event,
      payloadKeys: Object.keys(payload),
      processedAt: new Date().toISOString(),
    };
  },
});
