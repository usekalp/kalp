import { defineWebhook } from "@kalphq/sdk";
import { z } from "zod";

/**
 * Exchange webhook for order execution confirmations
 */
export const exchangeWebhook = defineWebhook({
  id: "exchange_webhook",
  input: z.object({
    orderId: z.string(),
    symbol: z.string(),
    side: z.string(), // "buy", "sell"
    status: z.string(), // "filled", "partial", "rejected"
    filledQty: z.number(),
    avgPrice: z.number(),
    commission: z.number(),
  }),
  async handler({ orderId, symbol, side, status, filledQty, avgPrice, commission }) {
    // Process order execution from exchange
    // In real implementation, update portfolio holdings

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
