// Superseded by static template at templates/agents/customer-support/ (used via giget)

import type { Template } from "./index.js";

export const customerSupport: Template = {
  id: "customer-support",
  secrets: ["OPENAI_API_KEY"],
  files: (agent) => [
    // ── Agent entry ──────────────────────────────────────────────────────
    {
      path: `agents/${agent}/index.ts`,
      content: `import { asAgentId, defineAgent } from "@kalphq/sdk";
import { classifyTicket } from "./steps/classify-ticket.js";
import { escalateTicket } from "./steps/escalate-ticket.js";
import { searchKnowledgeBase } from "./tools/search-kb.js";
import { createJiraIssue } from "./tools/create-jira-issue.js";
import { slackEscalation } from "./webhooks/slack-escalation.js";
import { zendeskTicket } from "./webhooks/zendesk-ticket.js";
import { escalationNeeded } from "./signals/escalation-needed.js";
import { ticketResolved } from "./signals/ticket-resolved.js";

export default defineAgent({
  id: asAgentId("${agent}"),
  name: "${agent}",
  description: "Handles incoming support tickets with AI-powered routing.",
  steps: [classifyTicket, escalateTicket],
  tools: [searchKnowledgeBase, createJiraIssue],
  webhooks: [slackEscalation, zendeskTicket],
  signals: [escalationNeeded, ticketResolved],

  systemPrompt: "You are a friendly support agent. Classify tickets, search the knowledge base, and resolve issues efficiently.",

  async onMessage(message, ctx) {
    const ticket = await ctx.runStep(classifyTicket, { text: message.text });

    const escalation = await ctx.runStep(escalateTicket, {
      category: ticket.category,
      priority: ticket.priority,
      sentiment: "neutral",
      previousAttempts: 0,
    });

    if (escalation.escalate) {
      if (ticket.category === "technical") {
        const jira = await ctx.callTool(createJiraIssue, {
          summary: \`Support Ticket: \${message.text.slice(0, 50)}...\`,
          description: message.text,
          priority: ticket.priority,
          reporter: "support-agent",
        });
        return { text: \`Escalated to engineering team. Issue: \${jira.issueKey}\` };
      }
      return { text: \`Escalating to \${escalation.assignTo}: \${escalation.reason}\` };
    }

    const results = await ctx.callTool(searchKnowledgeBase, { query: message.text });
    return { text: results.answer ?? "Let me connect you with a specialist." };
  },
});
`,
    },
    // ── Steps ────────────────────────────────────────────────────────────
    {
      path: `agents/${agent}/steps/classify-ticket.ts`,
      content: `import { createStep } from "@kalphq/sdk";
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
      prompt: \`Classify this support ticket: "\${text}"\`,
      schema: z.object({
        category: z.enum(["billing", "technical", "general"]),
        priority: z.enum(["low", "medium", "high"]),
      }),
    });
    return result;
  },
});
`,
    },
    {
      path: `agents/${agent}/steps/escalate-ticket.ts`,
      content: `import { createStep } from "@kalphq/sdk";
import { z } from "zod";

export const escalateTicket = createStep({
  id: "escalate_ticket",
  description: "Determines if a ticket should be escalated to human support.",
  input: z.object({
    category: z.string(),
    priority: z.string(),
    sentiment: z.string(),
    previousAttempts: z.number().default(0),
  }),
  output: z.object({
    escalate: z.boolean(),
    reason: z.string(),
    assignTo: z.string(),
  }),
  async run({ category, priority, sentiment, previousAttempts }) {
    if ((sentiment === "frustrated" || sentiment === "angry") && category === "technical") {
      return { escalate: true, reason: "Frustrated customer with technical issue", assignTo: "tier2" };
    }
    if (priority === "high" && category === "billing") {
      return { escalate: true, reason: "High priority billing issue", assignTo: "tier3" };
    }
    if (previousAttempts >= 3) {
      return { escalate: true, reason: \`Multiple failed attempts (\${previousAttempts})\`, assignTo: "human" };
    }
    return { escalate: false, reason: "Within agent capabilities", assignTo: "tier1" };
  },
});
`,
    },
    // ── Tools ────────────────────────────────────────────────────────────
    {
      path: `agents/${agent}/tools/search-kb.ts`,
      content: `import { createTool } from "@kalphq/sdk";
import { z } from "zod";

export const searchKnowledgeBase = createTool({
  id: "search_kb",
  description: "Searches the product knowledge base for relevant articles.",
  input: z.object({ query: z.string() }),
  async execute({ query }) {
    return { answer: null, sources: [] };
  },
});
`,
    },
    {
      path: `agents/${agent}/tools/create-jira-issue.ts`,
      content: `import { createTool } from "@kalphq/sdk";
import { z } from "zod";

export const createJiraIssue = createTool({
  id: "create_jira_issue",
  description: "Creates a bug ticket in Jira for technical issues requiring engineering.",
  input: z.object({
    summary: z.string(),
    description: z.string(),
    priority: z.string(),
    component: z.string().optional(),
    reporter: z.string(),
  }),
  async execute({ summary, description, priority, component, reporter }) {
    const issueKey = \`PROJ-\${Math.floor(Math.random() * 10000)}\`;
    return {
      created: true,
      issueKey,
      summary,
      priority,
      component: component ?? "General",
      reporter,
      url: \`https://jira.example.com/browse/\${issueKey}\`,
    };
  },
});
`,
    },
    // ── Webhooks ─────────────────────────────────────────────────────────
    {
      path: `agents/${agent}/webhooks/slack-escalation.ts`,
      content: `import { defineWebhook } from "@kalphq/sdk";
import { z } from "zod";

export const slackEscalation = defineWebhook({
  id: "slack_escalation",
  input: z.object({
    userId: z.string(),
    channelId: z.string(),
    ticketId: z.string(),
    reason: z.string(),
    urgency: z.string(),
  }),
  async handler({ userId, channelId, ticketId, reason, urgency }) {
    return {
      acknowledged: true,
      ticketId,
      escalationId: \`ESC-\${Date.now()}\`,
      estimatedResponse: urgency === "high" ? "5 minutes" : "30 minutes",
    };
  },
});
`,
    },
    {
      path: `agents/${agent}/webhooks/zendesk-ticket.ts`,
      content: `import { defineWebhook } from "@kalphq/sdk";
import { z } from "zod";

export const zendeskTicket = defineWebhook({
  id: "zendesk_ticket",
  input: z.object({
    ticketId: z.string(),
    status: z.string(),
    subject: z.string(),
    requesterEmail: z.string(),
    tags: z.array(z.string()),
    customFields: z.record(z.unknown()).optional(),
  }),
  async handler({ ticketId, status, subject, requesterEmail, tags }) {
    return {
      synced: true,
      externalId: ticketId,
      localId: \`LOCAL-\${ticketId}\`,
      status,
      tags,
    };
  },
});
`,
    },
    // ── Signals ──────────────────────────────────────────────────────────
    {
      path: `agents/${agent}/signals/escalation-needed.ts`,
      content: `import { createSignal } from "@kalphq/sdk";
import { z } from "zod";

export const escalationNeeded = createSignal({
  id: "escalation_needed",
  input: z.object({
    ticketId: z.string(),
    customerId: z.string(),
    issue: z.string(),
    priority: z.string(),
    previousAttempts: z.number(),
    sentiment: z.string(),
  }),
  async handler({ ticketId, customerId, issue, priority }) {
    return {
      received: true,
      ticketId,
      assignedTier: priority === "high" ? "tier3" : "tier2",
      estimatedHandleTime: priority === "high" ? "15 min" : "1 hour",
    };
  },
});
`,
    },
    {
      path: `agents/${agent}/signals/ticket-resolved.ts`,
      content: `import { createSignal } from "@kalphq/sdk";
import { z } from "zod";

export const ticketResolved = createSignal({
  id: "ticket_resolved",
  input: z.object({
    ticketId: z.string(),
    customerId: z.string(),
    resolution: z.string(),
    satisfaction: z.string(),
    resolutionTime: z.number(),
  }),
  async handler({ ticketId, customerId, resolution, satisfaction, resolutionTime }) {
    return {
      recorded: true,
      ticketId,
      customerId,
      satisfaction,
      resolutionTime,
      timestamp: new Date().toISOString(),
    };
  },
});
`,
    },
  ],
};
