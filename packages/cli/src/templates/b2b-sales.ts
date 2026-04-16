// Superseded by static template at templates/agents/b2b-sales/ (used via giget)

import type { Template } from "./index.js";

export const b2bSales: Template = {
  id: "b2b-sales",
  secrets: ["OPENAI_API_KEY", "CRM_API_KEY"],
  files: (agent) => [
    // ── Agent entry ──────────────────────────────────────────────────────
    {
      path: `agents/${agent}/index.ts`,
      content: `import { asAgentId, defineAgent } from "@kalphq/sdk";
import { scoreLead } from "./steps/score-lead.js";
import { qualifyProspect } from "./steps/qualify-prospect.js";
import { enrichCompany } from "./tools/enrich-company.js";
import { sendSlackNotification } from "./tools/send-slack-notification.js";
import { crmInbound } from "./webhooks/crm-inbound.js";
import { stripePayment } from "./webhooks/stripe-payment.js";
import { hotLeadAlert } from "./signals/hot-lead-alert.js";
import { dealWon } from "./signals/deal-won.js";

export default defineAgent({
  id: asAgentId("${agent}"),
  name: "${agent}",
  description: "Automates B2B outreach with lead scoring and CRM enrichment.",
  steps: [scoreLead, qualifyProspect],
  tools: [enrichCompany, sendSlackNotification],
  webhooks: [crmInbound, stripePayment],
  signals: [hotLeadAlert, dealWon],

  systemPrompt: "You are a B2B sales assistant. Score leads, enrich company data, and draft personalized outreach messages.",

  async onMessage(message, ctx) {
    const lead = await ctx.runStep(scoreLead, { company: message.text });

    if (lead.score < 50) {
      return { text: "Lead score too low — skipping outreach." };
    }

    const qualified = await ctx.runStep(qualifyProspect, {
      company: message.text,
      score: lead.score,
      domain: lead.domain,
    });

    if (!qualified.qualified) {
      return { text: \`Prospect not qualified: \${qualified.reason}\` };
    }

    const enriched = await ctx.callTool(enrichCompany, { domain: lead.domain });

    if (qualified.priority === "high") {
      await ctx.callTool(sendSlackNotification, {
        company: message.text,
        score: lead.score,
        domain: lead.domain,
      });
    }

    return {
      text: \`\${enriched.companyName} (\${lead.score}/100, \${qualified.priority} priority) — Ready for outreach.\`,
    };
  },
});
`,
    },
    // ── Steps ────────────────────────────────────────────────────────────
    {
      path: `agents/${agent}/steps/score-lead.ts`,
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
    {
      path: `agents/${agent}/steps/qualify-prospect.ts`,
      content: `import { createStep } from "@kalphq/sdk";
import { z } from "zod";

export const qualifyProspect = createStep({
  id: "qualify_prospect",
  description: "Deep qualification of prospects based on lead score and company data.",
  input: z.object({
    company: z.string(),
    score: z.number(),
    domain: z.string(),
  }),
  output: z.object({
    qualified: z.boolean(),
    reason: z.string(),
    priority: z.string(),
  }),
  async run({ company, score, domain }) {
    if (score >= 80) {
      return {
        qualified: true,
        reason: "High engagement score indicates strong interest",
        priority: "high",
      };
    }
    if (score >= 50) {
      const isEnterprise = domain.includes("enterprise") || domain.endsWith(".corp");
      return {
        qualified: isEnterprise,
        reason: isEnterprise
          ? "Enterprise domain with decent engagement"
          : "Score too low for non-enterprise domain",
        priority: isEnterprise ? "medium" : "low",
      };
    }
    return {
      qualified: false,
      reason: "Low engagement score",
      priority: "low",
    };
  },
});
`,
    },
    // ── Tools ────────────────────────────────────────────────────────────
    {
      path: `agents/${agent}/tools/enrich-company.ts`,
      content: `import { createTool } from "@kalphq/sdk";
import { z } from "zod";

export const enrichCompany = createTool({
  id: "enrich_company",
  description: "Fetches enriched company data from the CRM.",
  input: z.object({ domain: z.string() }),
  async execute({ domain }) {
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
      path: `agents/${agent}/tools/send-slack-notification.ts`,
      content: `import { createTool } from "@kalphq/sdk";
import { z } from "zod";

export const sendSlackNotification = createTool({
  id: "send_slack_notification",
  description: "Sends a notification to Slack channel for hot leads.",
  input: z.object({
    company: z.string(),
    score: z.number(),
    domain: z.string(),
    channel: z.string().default("#sales-hot-leads"),
  }),
  async execute({ company, score, domain, channel }) {
    return {
      sent: true,
      channel,
      message: \`Hot Lead Alert: \${company} (\${domain}) scored \${score}/100\`,
      timestamp: new Date().toISOString(),
    };
  },
});
`,
    },
    // ── Webhooks ─────────────────────────────────────────────────────────
    {
      path: `agents/${agent}/webhooks/crm-inbound.ts`,
      content: `import { defineWebhook } from "@kalphq/sdk";
import { z } from "zod";

export const crmInbound = defineWebhook({
  id: "crm_inbound",
  input: z.object({
    leadId: z.string(),
    email: z.string().email(),
    company: z.string(),
    source: z.string(),
    metadata: z.record(z.unknown()).optional(),
  }),
  async handler({ leadId, email, company, source }) {
    return {
      success: true,
      message: "Lead received",
      leadId,
      company,
      source,
    };
  },
});
`,
    },
    {
      path: `agents/${agent}/webhooks/stripe-payment.ts`,
      content: `import { defineWebhook } from "@kalphq/sdk";
import { z } from "zod";

export const stripePayment = defineWebhook({
  id: "stripe_payment",
  input: z.object({
    type: z.string(),
    customerId: z.string(),
    amount: z.number().optional(),
    currency: z.string().default("usd"),
    metadata: z.record(z.unknown()).optional(),
  }),
  async handler({ type, customerId, amount, currency }) {
    return {
      received: true,
      eventType: type,
      customerId,
      amount,
      currency,
    };
  },
});
`,
    },
    // ── Signals ──────────────────────────────────────────────────────────
    {
      path: `agents/${agent}/signals/hot-lead-alert.ts`,
      content: `import { createSignal } from "@kalphq/sdk";
import { z } from "zod";

export const hotLeadAlert = createSignal({
  id: "hot_lead_alert",
  input: z.object({
    leadId: z.string(),
    company: z.string(),
    score: z.number(),
    email: z.string(),
    priority: z.string(),
    qualified: z.boolean(),
  }),
  async handler({ leadId, company, score, email, priority, qualified }) {
    return {
      acknowledged: true,
      leadId,
      company,
      score,
      priority,
      qualified,
    };
  },
});
`,
    },
    {
      path: `agents/${agent}/signals/deal-won.ts`,
      content: `import { createSignal } from "@kalphq/sdk";
import { z } from "zod";

export const dealWon = createSignal({
  id: "deal_won",
  input: z.object({
    customerId: z.string(),
    leadId: z.string().optional(),
    amount: z.number().optional(),
    currency: z.string(),
    source: z.string(),
    repId: z.string().optional(),
  }),
  async handler({ customerId, leadId, amount, currency, source, repId }) {
    return {
      recorded: true,
      dealId: leadId ?? customerId,
      amount,
      currency,
      source,
      commissionRep: repId,
    };
  },
});
`,
    },
  ],
};
