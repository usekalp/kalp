import { asAgentId, defineAgent } from "@kalphq/sdk";
import { scoreLead } from "./steps/score-lead.js";
import { qualifyProspect } from "./steps/qualify-prospect.js";
import { enrichCompany } from "./tools/enrich-company.js";
import { sendSlackNotification } from "./tools/send-slack-notification.js";
import { crmInbound } from "./webhooks/crm-inbound.js";
import { stripePayment } from "./webhooks/stripe-payment.js";
import { hotLeadAlert } from "./signals/hot-lead-alert.js";
import { dealWon } from "./signals/deal-won.js";

export default defineAgent({
  id: asAgentId("__AGENT_NAME__"),
  name: "__AGENT_NAME__",
  description: "Automates B2B outreach with lead scoring and CRM enrichment.",
  steps: [scoreLead, qualifyProspect],
  tools: [enrichCompany, sendSlackNotification],
  webhooks: [crmInbound, stripePayment],
  signals: [hotLeadAlert, dealWon],

  systemPrompt:
    "You are a B2B sales assistant. Score leads, enrich company data, and draft personalized outreach messages.",

  async onMessage(message, ctx) {
    const lead = await ctx.runStep(scoreLead, { company: message.text });

    if (lead.score < 50) {
      return { text: "Lead score too low — skipping outreach." };
    }

    // Qualify the prospect
    const qualified = await ctx.runStep(qualifyProspect, {
      company: message.text,
      score: lead.score,
      domain: lead.domain,
    });

    if (!qualified.qualified) {
      return { text: `Prospect not qualified: ${qualified.reason}` };
    }

    const enriched = await ctx.callTool(enrichCompany, { domain: lead.domain });

    // Notify for high-priority leads
    if (qualified.priority === "high") {
      await ctx.callTool(sendSlackNotification, {
        company: message.text,
        score: lead.score,
        domain: lead.domain,
        channel: "sales-alerts",
      });
    }

    return {
      text: `${enriched.companyName} (${lead.score}/100, ${qualified.priority} priority) — Ready for outreach.`,
    };
  },
});
