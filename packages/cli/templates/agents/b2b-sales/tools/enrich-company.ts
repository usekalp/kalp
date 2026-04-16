import { createTool } from "@kalphq/sdk";
import { z } from "zod";

export const enrichCompany = createTool({
  id: "enrich_company",
  description: "Fetches enriched company data from the CRM.",
  input: z.object({ domain: z.string() }),
  async execute({ domain }, ctx) {
    ctx.logger.info("Enriching company", { domain });
    // Replace with actual CRM API call
    return {
      companyName: domain.split(".")[0] ?? domain,
      employees: 0,
      industry: "Unknown",
    };
  },
});
