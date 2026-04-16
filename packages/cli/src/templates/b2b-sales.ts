// @ts-nocheck
// Superseded by static template at templates/agents/b2b-sales/ (used via giget)

export const b2bSales: Template = {
  id: "b2b-sales",
  secrets: ["OPENAI_API_KEY", "CRM_API_KEY"],
  files: (agent) => [
    // ── Agent entry ──────────────────────────────────────────────────────
    {
      path: `kalp/agents/${agent}/index.ts`,
      content: `import { asAgentId, defineAgent } from "@kalphq/sdk";
import { scoreLead } from "./steps/score-lead.js";
import { enrichCompany } from "./tools/enrich-company.js";

export default defineAgent({
  id: asAgentId("${agent}"),
  name: "${agent}",
  description: "Automates B2B outreach with lead scoring and CRM enrichment.",
  steps: [scoreLead],
  tools: [enrichCompany],

  systemPrompt: "You are a B2B sales assistant. Score leads, enrich company data, and draft personalized outreach messages.",

  async onMessage(message, ctx) {
    const lead = await ctx.runStep(scoreLead, { company: message.text });

    if (lead.score < 50) {
      return { text: "Lead score too low — skipping outreach." };
    }

    const enriched = await ctx.callTool(enrichCompany, {
      domain: lead.domain,
    });

    return {
      text: \`\${enriched.companyName} (\${lead.score}/100) — Ready for outreach.\`,
    };
  },
});
`,
    },
    // ── Steps ────────────────────────────────────────────────────────────
    {
      path: `kalp/agents/${agent}/steps/score-lead.ts`,
      content: `import { createStep } from "@kalphq/sdk";
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
      prompt: \`Score this B2B lead for "\${company}". Provide a score 0-100, the company domain, and a brief reason.\`,
      schema: z.object({
        score: z.number().min(0).max(100),
        domain: z.string(),
        reason: z.string(),
      }),
    });
    return result;
  },
});
`,
    },
    // ── Tools ────────────────────────────────────────────────────────────
    {
      path: `kalp/agents/${agent}/tools/enrich-company.ts`,
      content: `import { createTool } from "@kalphq/sdk";
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
`,
    },
    {
      path: `kalp/agents/${agent}/webhooks/.gitkeep`,
      content: "",
    },
    {
      path: `kalp/agents/${agent}/signals/.gitkeep`,
      content: "",
    },
  ],
};
