// Superseded by static template at templates/agents/financial-agent/ (used via giget)

import type { Template } from "./index.js";

export const financialAgent: Template = {
  id: "financial-agent",
  secrets: ["OPENAI_API_KEY", "MARKET_DATA_API_KEY"],
  files: (agent) => [
    // ── Agent entry ──────────────────────────────────────────────────────
    {
      path: `agents/${agent}/index.ts`,
      content: `import { asAgentId, defineAgent } from "@kalphq/sdk";
import { analyzeSignal } from "./steps/analyze-signal.js";
import { rebalanceCheck } from "./steps/rebalance-check.js";
import { fetchMarketData } from "./tools/fetch-market-data.js";
import { sendEmailAlert } from "./tools/send-email-alert.js";
import { tradingviewAlert } from "./webhooks/tradingview-alert.js";
import { exchangeWebhook } from "./webhooks/exchange-webhook.js";
import { marketAlert } from "./signals/market-alert.js";
import { portfolioRebalance } from "./signals/portfolio-rebalance.js";

export default defineAgent({
  id: asAgentId("${agent}"),
  name: "${agent}",
  description: "Monitors market signals and provides financial analysis.",
  steps: [analyzeSignal, rebalanceCheck],
  tools: [fetchMarketData, sendEmailAlert],
  webhooks: [tradingviewAlert, exchangeWebhook],
  signals: [marketAlert, portfolioRebalance],

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

    if (Math.abs(market.change) > 5) {
      await ctx.callTool(sendEmailAlert, {
        to: "portfolio@example.com",
        subject: \`Alert: \${market.symbol} moved \${market.change}%\`,
        alertType: "price_movement",
        data: { symbol: market.symbol, change: market.change, price: market.price },
      });
    }

    return { text: analysis.summary };
  },
});
`,
    },
    // ── Steps ────────────────────────────────────────────────────────────
    {
      path: `agents/${agent}/steps/analyze-signal.ts`,
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
    {
      path: `agents/${agent}/steps/rebalance-check.ts`,
      content: `import { createStep } from "@kalphq/sdk";
import { z } from "zod";

export const rebalanceCheck = createStep({
  id: "rebalance_check",
  description: "Analyzes portfolio and recommends rebalancing actions.",
  input: z.object({
    portfolioValue: z.number(),
    targetAllocation: z.record(z.number()),
    currentAllocation: z.record(z.number()),
    riskTolerance: z.string(),
  }),
  output: z.object({
    needsRebalance: z.boolean(),
    driftPercent: z.number(),
    recommendations: z.array(z.object({
      asset: z.string(),
      action: z.string(),
      amount: z.number(),
    })),
  }),
  async run({ portfolioValue, targetAllocation, currentAllocation, riskTolerance }) {
    const recommendations = [];
    let maxDrift = 0;
    for (const [asset, targetPct] of Object.entries(targetAllocation)) {
      const currentPct = currentAllocation[asset] ?? 0;
      const drift = Math.abs(currentPct - targetPct);
      maxDrift = Math.max(maxDrift, drift);
      if (drift > 5) {
        const targetValue = portfolioValue * (targetPct / 100);
        const currentValue = portfolioValue * (currentPct / 100);
        const diff = targetValue - currentValue;
        recommendations.push({ asset, action: diff > 0 ? "buy" : "sell", amount: Math.abs(diff) });
      }
    }
    const threshold = riskTolerance === "conservative" ? 3 : riskTolerance === "aggressive" ? 8 : 5;
    return { needsRebalance: maxDrift > threshold, driftPercent: maxDrift, recommendations };
  },
});
`,
    },
    // ── Tools ────────────────────────────────────────────────────────────
    {
      path: `agents/${agent}/tools/fetch-market-data.ts`,
      content: `import { createTool } from "@kalphq/sdk";
import { z } from "zod";

export const fetchMarketData = createTool({
  id: "fetch_market_data",
  description: "Fetches real-time market data for a given symbol.",
  input: z.object({ symbol: z.string() }),
  async execute({ symbol }) {
    return { symbol, price: 0, change: 0, volume: 0 };
  },
});
`,
    },
    {
      path: `agents/${agent}/tools/send-email-alert.ts`,
      content: `import { createTool } from "@kalphq/sdk";
import { z } from "zod";

export const sendEmailAlert = createTool({
  id: "send_email_alert",
  description: "Sends email notifications for significant portfolio events.",
  input: z.object({
    to: z.string(),
    subject: z.string(),
    alertType: z.string(),
    data: z.record(z.unknown()),
  }),
  async execute({ to, subject, alertType, data }) {
    return {
      sent: true,
      recipient: to,
      subject,
      alertType,
      messageId: \`msg_\${Date.now()}\`,
    };
  },
});
`,
    },
    // ── Webhooks ─────────────────────────────────────────────────────────
    {
      path: `agents/${agent}/webhooks/tradingview-alert.ts`,
      content: `import { defineWebhook } from "@kalphq/sdk";
import { z } from "zod";

export const tradingviewAlert = defineWebhook({
  id: "tradingview_alert",
  input: z.object({
    symbol: z.string(),
    indicator: z.string(),
    signal: z.string(),
    value: z.number(),
    timeframe: z.string(),
    price: z.number(),
  }),
  async handler({ symbol, indicator, signal, value, timeframe, price }) {
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
`,
    },
    {
      path: `agents/${agent}/webhooks/exchange-webhook.ts`,
      content: `import { defineWebhook } from "@kalphq/sdk";
import { z } from "zod";

export const exchangeWebhook = defineWebhook({
  id: "exchange_webhook",
  input: z.object({
    orderId: z.string(),
    symbol: z.string(),
    side: z.string(),
    status: z.string(),
    filledQty: z.number(),
    avgPrice: z.number(),
    commission: z.number(),
  }),
  async handler({ orderId, symbol, side, status, filledQty, avgPrice, commission }) {
    return {
      confirmed: true,
      orderId,
      symbol,
      side,
      status,
      totalValue: filledQty * avgPrice,
      commission,
      netProceeds: filledQty * avgPrice - commission,
    };
  },
});
`,
    },
    // ── Signals ──────────────────────────────────────────────────────────
    {
      path: `agents/${agent}/signals/market-alert.ts`,
      content: `import { createSignal } from "@kalphq/sdk";
import { z } from "zod";

export const marketAlert = createSignal({
  id: "market_alert",
  input: z.object({
    symbol: z.string(),
    eventType: z.string(),
    changePercent: z.number(),
    volume: z.number(),
    averageVolume: z.number(),
  }),
  async handler({ symbol, eventType, changePercent, volume, averageVolume }) {
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
`,
    },
    {
      path: `agents/${agent}/signals/portfolio-rebalance.ts`,
      content: `import { createSignal } from "@kalphq/sdk";
import { z } from "zod";

export const portfolioRebalance = createSignal({
  id: "portfolio_rebalance",
  input: z.object({
    portfolioId: z.string(),
    driftPercent: z.number(),
    triggeredBy: z.string(),
    targetAllocation: z.record(z.number()),
  }),
  async handler({ portfolioId, driftPercent, triggeredBy, targetAllocation }) {
    return {
      acknowledged: true,
      portfolioId,
      priority: driftPercent > 10 ? "urgent" : "normal",
      triggeredBy,
      estimatedTrades: Object.keys(targetAllocation).length,
    };
  },
});
`,
    },
  ],
};
