import { defineWebhook } from "@kalphq/sdk";
import { z } from "zod";

/**
 * Health check endpoint for monitoring
 */
export const healthCheck = defineWebhook({
  id: "health_check",
  input: z.object({
    check: z.string().default("ping"),
  }),
  async handler({ check }) {
    // Simple health check response
    // In real implementation, check dependencies

    return {
      status: "healthy",
      check,
      uptime: "100%",
      timestamp: new Date().toISOString(),
    };
  },
});
