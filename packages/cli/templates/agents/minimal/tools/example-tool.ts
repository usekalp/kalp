import { createTool } from "@kalphq/sdk";
import { z } from "zod";

export const exampleTool = createTool({
  id: "example_tool",
  description: "A stub tool — replace with your own external call.",
  input: z.object({ query: z.string() }),
  async execute({ query }, ctx) {
    ctx.logger.info("Calling example tool", { query });
    // Replace with your actual external API call
    return { output: `Result for: ${query}` };
  },
});
