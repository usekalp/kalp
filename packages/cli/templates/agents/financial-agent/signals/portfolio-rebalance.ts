import { createSignal } from "@kalphq/sdk";
import { z } from "zod";

/**
 * Signal to trigger portfolio rebalancing
 */
export const portfolioRebalance = createSignal({
  id: "portfolio_rebalance",
  input: z.object({
    portfolioId: z.string(),
    driftPercent: z.number(),
    triggeredBy: z.string(), // "scheduled", "threshold", "manual"
    targetAllocation: z.record(z.number()),
  }),
  async handler({ portfolioId, driftPercent, triggeredBy, targetAllocation }) {
    // Signal portfolio agents to execute rebalancing
    // In real implementation, generate orders for execution

    return {
      acknowledged: true,
      portfolioId,
      priority: driftPercent > 10 ? "urgent" : "normal",
      triggeredBy,
      estimatedTrades: Object.keys(targetAllocation).length,
    };
  },
});
