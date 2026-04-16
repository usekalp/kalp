import { createTool } from "@kalphq/sdk";
import { z } from "zod";

export const searchKnowledgeBase = createTool({
  id: "search_kb",
  description: "Searches the product knowledge base for relevant articles.",
  input: z.object({ query: z.string() }),
  async execute({ query }, ctx) {
    ctx.logger.info("Searching KB", { query });
    // Replace with your actual knowledge base search logic
    return { answer: null as string | null, sources: [] as string[] };
  },
});
