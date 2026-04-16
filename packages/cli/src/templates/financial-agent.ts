// @ts-nocheck
// Superseded by static template at templates/agents/financial-agent/ (used via giget)

export const financialAgent: Template = {
  id: "financial-agent",
  secrets: ["OPENAI_API_KEY", "MARKET_DATA_API_KEY"],
  files: (agent) => [
    // ── Agent entry ──────────────────────────────────────────────────────
    {
      path: `kalp/agents/${agent}/index.ts`,
      content: `import { asAgentId, defineAgent } from "@kalphq/sdk";
import { analyzeSignal } from "./steps/analyze-signal.js";
import { fetchMarketData } from "./tools/fetch-market-data.js";

export default defineAgent({
  id: asAgentId("${agent}"),
  name: "${agent}",
  description: "Monitors market signals and provides financial analysis.",
  steps: [analyzeSignal],
  tools: [fetchMarketData],

  systemPrompt: "You are a financial analysis agent. Interpret market signals, fetch live data, and provide actionable insights.",

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
`,
    },
    // ── Steps ────────────────────────────────────────────────────────────
    {
      path: `kalp/agents/${agent}/steps/analyze-signal.ts`,
      content: `import { createStep } from "@kalphq/sdk";
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
      prompt: \`Analyze this market signal: \${symbol} at $\${price} (\${change > 0 ? "+" : ""}\${change}%). Give sentiment and a one-line summary.\`,
      schema: z.object({
        sentiment: z.enum(["bullish", "bearish", "neutral"]),
        summary: z.string(),
      }),
    });
    return result;
  },
});
`,
    },
    // ── Tools ────────────────────────────────────────────────────────────
    {
      path: `kalp/agents/${agent}/tools/fetch-market-data.ts`,
      content: `import { createTool } from "@kalphq/sdk";
import { z } from "zod";

export const fetchMarketData = createTool({
  id: "fetch_market_data",
  description: "Fetches real-time market data for a given symbol.",
  input: z.object({ symbol: z.string() }),
  async execute({ symbol }, ctx) {
    ctx.logger.info("Fetching market data", { symbol });
    // Replace with actual market data API call
    return { symbol, price: 0, change: 0, volume: 0 };
  },
});
`,
    },
    {
      path: `kalp/agents/${agent}/webhooks/.gitkeep`,
      content: "",
    },
    {
      path: `kalp/agents/${agent}/signals/.gitkeep`,
      content: "",
    },
  ],
};
