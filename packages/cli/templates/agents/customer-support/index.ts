import { asAgentId, defineAgent } from "@kalphq/sdk";
import { classifyTicket } from "./steps/classify-ticket.js";
import { searchKnowledgeBase } from "./tools/search-kb.js";

export default defineAgent({
  id: asAgentId("__AGENT_NAME__"),
  name: "__AGENT_NAME__",
  description: "Handles incoming support tickets with AI-powered routing.",
  steps: [classifyTicket],
  tools: [searchKnowledgeBase],

  systemPrompt:
    "You are a friendly support agent. Classify tickets, search the knowledge base, and resolve issues efficiently.",

  async onMessage(message, ctx) {
    const ticket = await ctx.runStep(classifyTicket, { text: message.text });

    if (ticket.category === "billing") {
      return { text: "Routing to billing team..." };
    }

    const results = await ctx.callTool(searchKnowledgeBase, {
      query: message.text,
    });

    return { text: results.answer ?? "Let me escalate this to a human agent." };
  },
});
