import { asAgentId, defineAgent } from "@kalphq/sdk";
import { scoreLead } from "./steps/score-lead.js";
import { enrichCompany } from "./tools/enrich-company.js";

export default defineAgent({
  id: asAgentId("__AGENT_NAME__"),
  name: "__AGENT_NAME__",
  description: "Automates B2B outreach with lead scoring and CRM enrichment.",
  steps: [scoreLead],
  tools: [enrichCompany],

  systemPrompt:
    "You are a B2B sales assistant. Score leads, enrich company data, and draft personalized outreach messages.",

  async onMessage(message, ctx) {
    const lead = await ctx.runStep(scoreLead, { company: message.text });

    if (lead.score < 50) {
      return { text: "Lead score too low — skipping outreach." };
    }

    const enriched = await ctx.callTool(enrichCompany, { domain: lead.domain });

    return {
      text: `${enriched.companyName} (${lead.score}/100) — Ready for outreach.`,
    };
  },
});
