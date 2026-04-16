// Superseded by static template at templates/agents/customer-support/ (used via giget)
// @ts-nocheck

export const customerSupport: Template = {
  id: "customer-support",
  secrets: ["OPENAI_API_KEY"],
  files: (agent) => [
    // ── Agent entry ──────────────────────────────────────────────────────
    {
      path: `kalp/agents/${agent}/index.ts`,
      content: `import { asAgentId, defineAgent } from "@kalphq/sdk";
import { classifyTicket } from "./steps/classify-ticket.js";
import { searchKnowledgeBase } from "./tools/search-kb.js";

export default defineAgent({
  id: asAgentId("${agent}"),
  name: "${agent}",
  description: "Handles incoming support tickets with AI-powered routing.",
  steps: [classifyTicket],
  tools: [searchKnowledgeBase],

  systemPrompt: "You are a friendly support agent. Classify tickets, search the knowledge base, and resolve issues efficiently.",

  async onMessage(message, ctx) {
    const ticket = await ctx.runStep(classifyTicket, {
      text: message.text,
    });

    if (ticket.category === "billing") {
      return { text: "Routing to billing team..." };
    }

    const results = await ctx.callTool(searchKnowledgeBase, {
      query: message.text,
    });

    return { text: results.answer ?? "Let me escalate this to a human agent." };
  },
});
`,
    },
    // ── Steps ────────────────────────────────────────────────────────────
    {
      path: `kalp/agents/${agent}/steps/classify-ticket.ts`,
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
    // ── Tools ────────────────────────────────────────────────────────────
    {
      path: `kalp/agents/${agent}/tools/search-kb.ts`,
      content: `import { createTool } from "@kalphq/sdk";
import { z } from "zod";

export const searchKnowledgeBase = createTool({
  id: "search_kb",
  description: "Searches the product knowledge base for relevant articles.",
  input: z.object({ query: z.string() }),
  async execute({ query }, ctx) {
    ctx.logger.info("Searching KB", { query });
    // Replace with your actual knowledge base search logic
    return { answer: null as string | null, sources: [] as string[] };
  },
});
`,
    },
    // ── Webhook placeholder ──────────────────────────────────────────────
    {
      path: `kalp/agents/${agent}/webhooks/.gitkeep`,
      content: "",
    },
    // ── Signals placeholder ──────────────────────────────────────────────
    {
      path: `kalp/agents/${agent}/signals/.gitkeep`,
      content: "",
    },
  ],
};
