import { createSignal } from "@kalphq/sdk";
import { z } from "zod";

/**
 * Signal for unusual market movements
 */
export const marketAlert = createSignal({
  id: "market_alert",
  input: z.object({
    symbol: z.string(),
    eventType: z.string(), // "gap_up", "gap_down", "high_volume", "volatility_spike"
    changePercent: z.number(),
    volume: z.number(),
    averageVolume: z.number(),
  }),
  async handler({ symbol, eventType, changePercent, volume, averageVolume }) {
    // Broadcast market alert to portfolio agents
    // In real implementation, trigger risk management

    const volumeRatio = volume / averageVolume;

    return {
      broadcast: true,
      symbol,
      eventType,
      severity: Math.abs(changePercent) > 5 || volumeRatio > 3 ? "high" : "medium",
      changePercent,
      volumeRatio: Number(volumeRatio.toFixed(2)),
    };
  },
});
