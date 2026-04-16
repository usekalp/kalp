import { asAgentId, defineAgent } from "@kalphq/sdk";
import { analyzeSignal } from "./steps/analyze-signal.js";
import { fetchMarketData } from "./tools/fetch-market-data.js";

export default defineAgent({
  id: asAgentId("__AGENT_NAME__"),
  name: "__AGENT_NAME__",
  description: "Monitors market signals and provides financial analysis.",
  steps: [analyzeSignal],
  tools: [fetchMarketData],

  systemPrompt:
    "You are a financial analysis agent. Interpret market signals, fetch live data, and provide actionable insights.",

  async onMessage(message, ctx) {
    const market = await ctx.callTool(fetchMarketData, {
      symbol: message.text.trim().toUpperCase(),
    });

    const analysis = await ctx.runStep(analyzeSignal, {
      symbol: market.symbol,
      price: market.price,
      change: market.change,
    });

    return { text: analysis.summary };
  },
});
