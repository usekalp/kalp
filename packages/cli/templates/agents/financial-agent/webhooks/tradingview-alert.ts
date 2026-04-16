import { defineWebhook } from "@kalphq/sdk";
import { z } from "zod";

/**
 * TradingView alert webhook for technical indicator signals
 */
export const tradingviewAlert = defineWebhook({
  id: "tradingview_alert",
  input: z.object({
    symbol: z.string(),
    indicator: z.string(), // "RSI", "MACD", "BB", "EMA_CROSS"
    signal: z.string(), // "buy", "sell", "neutral"
    value: z.number(),
    timeframe: z.string(), // "1h", "4h", "1d"
    price: z.number(),
  }),
  async handler({ symbol, indicator, signal, value, timeframe, price }) {
    // Process technical indicator alert from TradingView
    // In real implementation, trigger portfolio rebalancing

    return {
      processed: true,
      symbol,
      indicator,
      signal,
      timestamp: new Date().toISOString(),
      significance: signal === "buy" && value < 30 ? "high" : "medium",
    };
  },
});
