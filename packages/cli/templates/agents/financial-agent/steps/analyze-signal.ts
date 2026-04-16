import { createStep } from "@kalphq/sdk";
import { z } from "zod";

export const analyzeSignal = createStep({
  id: "analyze_signal",
  description: "Analyzes a market signal and produces a summary.",
  input: z.object({
    symbol: z.string(),
    price: z.number(),
    change: z.number(),
  }),
  output: z.object({
    sentiment: z.enum(["bullish", "bearish", "neutral"]),
    summary: z.string(),
  }),
  async run({ symbol, price, change }, ctx) {
    const result = await ctx.ai.generateObject({
      prompt: `Analyze this market signal: ${symbol} at $${price} (${change > 0 ? "+" : ""}${change}%). Give sentiment and a one-line summary.`,
      schema: z.object({
        sentiment: z.enum(["bullish", "bearish", "neutral"]),
        summary: z.string(),
      }),
    });
    return result;
  },
});
