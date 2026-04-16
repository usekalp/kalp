import { createStep } from "@kalphq/sdk";
import { z } from "zod";

export const qualifyProspect = createStep({
  id: "qualify_prospect",
  description:
    "Deep qualification of prospects based on lead score and company data.",
  input: z.object({
    company: z.string(),
    score: z.number(),
    domain: z.string(),
  }),
  output: z.object({
    qualified: z.boolean(),
    reason: z.string(),
    priority: z.string(), // "high" | "medium" | "low"
  }),
  async run({ company, score, domain }, ctx) {
    ctx.logger.info("Qualifying prospect", { company, score, domain });

    // Auto-qualify high scores
    if (score >= 80) {
      return {
        qualified: true,
        reason: "High engagement score indicates strong interest",
        priority: "high",
      };
    }

    // Qualify medium scores with domain check
    if (score >= 50) {
      const isEnterprise =
        domain.includes("enterprise") || domain.endsWith(".corp");
      return {
        qualified: isEnterprise,
        reason: isEnterprise
          ? "Enterprise domain with decent engagement"
          : "Score too low for non-enterprise domain",
        priority: isEnterprise ? "medium" : "low",
      };
    }

    // Low scores - not qualified
    return {
      qualified: false,
      reason: "Low engagement score",
      priority: "low",
    };
  },
});
