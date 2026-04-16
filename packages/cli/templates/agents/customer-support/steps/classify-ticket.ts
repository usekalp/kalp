import { createStep } from "@kalphq/sdk";
import { z } from "zod";

export const classifyTicket = createStep({
  id: "classify_ticket",
  description: "Classifies a support ticket by category and priority.",
  input: z.object({ text: z.string() }),
  output: z.object({
    category: z.enum(["billing", "technical", "general"]),
    priority: z.enum(["low", "medium", "high"]),
  }),
  async run({ text }, ctx) {
    const result = await ctx.ai.generateObject({
      prompt: `Classify this support ticket: "${text}"`,
      schema: z.object({
        category: z.enum(["billing", "technical", "general"]),
        priority: z.enum(["low", "medium", "high"]),
      }),
    });
    return result;
  },
});
