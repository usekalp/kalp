import { createStep } from "@kalphq/sdk";
import { z } from "zod";

export const rebalanceCheck = createStep({
  id: "rebalance_check",
  description: "Analyzes portfolio and recommends rebalancing actions.",
  input: z.object({
    portfolioValue: z.number(),
    targetAllocation: z.record(z.number()), // { stocks: 60, bonds: 30, cash: 10 }
    currentAllocation: z.record(z.number()),
    riskTolerance: z.string(), // "conservative", "moderate", "aggressive"
  }),
  output: z.object({
    needsRebalance: z.boolean(),
    driftPercent: z.number(),
    recommendations: z.array(z.object({
      asset: z.string(),
      action: z.string(), // "buy", "sell", "hold"
      amount: z.number(),
    })),
  }),
  async run({ portfolioValue, targetAllocation, currentAllocation, riskTolerance }) {
    const recommendations: Array<{ asset: string; action: string; amount: number }> = [];
    let maxDrift = 0;

    // Calculate drift for each asset
    for (const [asset, targetPct] of Object.entries(targetAllocation)) {
      const currentPct = currentAllocation[asset] ?? 0;
      const drift = Math.abs(currentPct - targetPct);
      maxDrift = Math.max(maxDrift, drift);

      // Generate recommendation if drift > 5%
      if (drift > 5) {
        const targetValue = portfolioValue * (targetPct / 100);
        const currentValue = portfolioValue * (currentPct / 100);
        const diff = targetValue - currentValue;

        recommendations.push({
          asset,
          action: diff > 0 ? "buy" : "sell",
          amount: Math.abs(diff),
        });
      }
    }

    // Conservative portfolios rebalance at lower drift
    const threshold = riskTolerance === "conservative" ? 3 : riskTolerance === "aggressive" ? 8 : 5;

    return {
      needsRebalance: maxDrift > threshold,
      driftPercent: maxDrift,
      recommendations,
    };
  },
});
