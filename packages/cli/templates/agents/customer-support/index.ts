import { asAgentId, defineAgent } from "@kalphq/sdk";
import { classifyTicket } from "./steps/classify-ticket.js";
import { escalateTicket } from "./steps/escalate-ticket.js";
import { searchKnowledgeBase } from "./tools/search-kb.js";
import { createJiraIssue } from "./tools/create-jira-issue.js";
import { slackEscalation } from "./webhooks/slack-escalation.js";
import { zendeskTicket } from "./webhooks/zendesk-ticket.js";
import { escalationNeeded } from "./signals/escalation-needed.js";
import { ticketResolved } from "./signals/ticket-resolved.js";

export default defineAgent({
  id: asAgentId("__AGENT_NAME__"),
  name: "__AGENT_NAME__",
  description: "Handles incoming support tickets with AI-powered routing.",
  steps: [classifyTicket, escalateTicket],
  tools: [searchKnowledgeBase, createJiraIssue],
  webhooks: [slackEscalation, zendeskTicket],
  signals: [escalationNeeded, ticketResolved],

  systemPrompt:
    "You are a friendly support agent. Classify tickets, search the knowledge base, and resolve issues efficiently.",

  async onMessage(message, ctx) {
    const ticket = await ctx.runStep(classifyTicket, { text: message.text });

    // Check if escalation is needed
    const escalation = await ctx.runStep(escalateTicket, {
      category: ticket.category,
      priority: ticket.priority,
      sentiment: "neutral", // Could be detected from message
      previousAttempts: 0,
    });

    if (escalation.escalate) {
      // Create Jira issue for technical problems
      if (ticket.category === "technical") {
        const jira = await ctx.callTool(createJiraIssue, {
          summary: `Support Ticket: ${message.text.slice(0, 50)}...`,
          description: message.text,
          priority: ticket.priority,
          reporter: "support-agent",
        });
        return {
          text: `Escalated to engineering team. Issue: ${jira.issueKey}`,
        };
      }

      return {
        text: `Escalating to ${escalation.assignTo}: ${escalation.reason}`,
      };
    }

    // Try knowledge base for non-escalated issues
    const results = await ctx.callTool(searchKnowledgeBase, {
      query: message.text,
    });

    return { text: results.answer ?? "Let me connect you with a specialist." };
  },
});
