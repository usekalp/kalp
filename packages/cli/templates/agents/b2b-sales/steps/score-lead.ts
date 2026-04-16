import { createStep } from "@kalphq/sdk";
import { z } from "zod";

export const scoreLead = createStep({
  id: "score_lead",
  description: "Scores a B2B lead based on company signals.",
  input: z.object({ company: z.string() }),
  output: z.object({
    score: z.number().min(0).max(100),
    domain: z.string(),
    reason: z.string(),
  }),
  async run({ company }, ctx) {
    const result = await ctx.ai.generateObject({
      prompt: `Score this B2B lead for "${company}". Provide a score 0-100, the company domain, and a brief reason.`,
      schema: z.object({
        score: z.number().min(0).max(100),
        domain: z.string(),
        reason: z.string(),
      }),
    });
    return result;
  },
});
