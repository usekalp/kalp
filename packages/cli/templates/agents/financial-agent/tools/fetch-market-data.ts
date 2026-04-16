import { createTool } from "@kalphq/sdk";
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
