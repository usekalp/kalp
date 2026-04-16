import { asAgentId, defineAgent } from "@kalphq/sdk";
import { analyzeSignal } from "./steps/analyze-signal.js";
import { rebalanceCheck } from "./steps/rebalance-check.js";
import { fetchMarketData } from "./tools/fetch-market-data.js";
import { sendEmailAlert } from "./tools/send-email-alert.js";
import { tradingviewAlert } from "./webhooks/tradingview-alert.js";
import { exchangeWebhook } from "./webhooks/exchange-webhook.js";
import { marketAlert } from "./signals/market-alert.js";
import { portfolioRebalance } from "./signals/portfolio-rebalance.js";

export default defineAgent({
  id: asAgentId("__AGENT_NAME__"),
  name: "__AGENT_NAME__",
  description: "Monitors market signals and provides financial analysis.",
  steps: [analyzeSignal, rebalanceCheck],
  tools: [fetchMarketData, sendEmailAlert],
  webhooks: [tradingviewAlert, exchangeWebhook],
  signals: [marketAlert, portfolioRebalance],

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

    // Send alert for significant movements
    if (Math.abs(market.change) > 5) {
      await ctx.callTool(sendEmailAlert, {
        to: "portfolio@example.com",
        subject: `Alert: ${market.symbol} moved ${market.change}%`,
        alertType: "price_movement",
        data: {
          symbol: market.symbol,
          change: market.change,
          price: market.price,
        },
      });
    }

    return { text: analysis.summary };
  },
});
