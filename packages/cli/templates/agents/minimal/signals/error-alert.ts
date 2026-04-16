import { createSignal } from "@kalphq/sdk";
import { z } from "zod";

/**
 * Signal sent when an error occurs
 */
export const errorAlert = createSignal({
  id: "error_alert",
  input: z.object({
    errorId: z.string(),
    message: z.string(),
    severity: z.string(), // "low", "medium", "high", "critical"
    context: z.record(z.unknown()).optional(),
  }),
  async handler({ errorId, message, severity, context }) {
    // Signal error to monitoring system
    // In real implementation, send to error tracking service

    return {
      logged: true,
      errorId,
      severity,
      alertSent: severity === "high" || severity === "critical",
    };
  },
});
