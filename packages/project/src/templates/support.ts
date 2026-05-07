/**
 * Support agent template - demonstrates Human-in-the-Loop with waitForEvent.
 *
 * Shows how an agent can pause execution for days until a human resolves a ticket.
 *
 * @module
 */

import { join } from "node:path";
import type { TemplateDefinition } from "./types";
import { writeTemplateFile } from "./utils";

/**
 * Generate the support agent template.
 */
async function generateSupport(opts: {
  agentName: string;
  cwd: string;
}): Promise<void> {
  const { agentName, cwd } = opts;
  const agentDir = join(cwd, "agents", agentName);

  // Main agent file with waitForEvent magic
  const agentIndex = [
    'import { defineAgent } from "@kalphq/sdk";',
    'import { createTicket } from "./steps/create-ticket";',
    'import { searchFaq } from "./steps/search-faq";',
    'import { draftResponse } from "./steps/draft-response";',
    'import { healthRoute } from "./routes/health";',
    'import { ticketWebhookRoute } from "./routes/ticket-webhook";',
    '',
    '/**',
    ' * Support agent demonstrating true Human-in-the-Loop.',
    ' *',
    ' * When negative sentiment is detected, the agent:',
    ' * 1. Creates a support ticket',
    ' * 2. PAUSES EXECUTION (server can shut down)',
    ' * 3. Waits for human to resolve via webhook',
    ' * 4. AUTO-RESUMES days later to notify the customer',
    ' *',
    ' * State (ticketId, user context) is preserved in the event log.',
    ' */',
    'export default defineAgent({',
    '  name: "' + agentName + '",',
    '  description: "Customer support with true Human-in-the-loop escalation",',
    '',
    '  routes: [healthRoute, ticketWebhookRoute],',
    '',
    '  async onMessage(ctx) {',
    '    // 1. Analyze sentiment to detect frustrated customers',
    '    const sentiment = await ctx.ai.classify({',
    '      input: ctx.message.text,',
    '      labels: ["angry", "frustrated", "neutral", "happy"],',
    '    });',
    '',
    '    if (sentiment === "angry" || sentiment === "frustrated") {',
    '      // 2. Create support ticket in external system (Zendesk/Jira)',
    '      const ticket = await ctx.actions.run(createTicket, {',
    '        reason: "Negative sentiment detected",',
    '        userText: ctx.message.text,',
    '        priority: "high",',
    '        userId: ctx.auth.userId,',
    '      });',
    '',
    '      // 3. THE KILLER FEATURE: Pause agent until human resolves ticket',
    '      // Server shuts down, but state (ticketId, user context) is preserved',
    '      // in the event-sourced execution log',
    '      const wakeReason = await ctx.actions.waitForEvent(',
    '        "ticket_resolved_" + ticket.id,',
    '        "7d" // timeout after 7 days',
    '      );',
    '',
    '      // 4. Agent revives (could be days later) and continues seamlessly',
    '      if (wakeReason.type === "event") {',
    '        return {',
    '          text: "Hi! Our manager reviewed your case and resolved it: " + wakeReason.payload.resolution + ". Is there anything else I can help with?",',
    '        };',
    '      }',
    '',
    '      return { text: "Your case is being handled by our team. You will hear back soon." };',
    '    }',
    '',
    '    // Normal flow: Try FAQ lookup first',
    '    const faqResult = await ctx.actions.run(searchFaq, { query: ctx.message.text });',
    '    if (faqResult.found) {',
    '      return { text: faqResult.answer };',
    '    }',
    '',
    '    // No FAQ match - draft a response for approval',
    '    const draft = await ctx.actions.run(draftResponse, { query: ctx.message.text });',
    '    return { text: draft.response, data: { needsApproval: true } };',
    '  },',
    '});',
  ].join("\n");

  // Create ticket step
  const createTicketStep = [
    'import { defineStep, z } from "@kalphq/sdk";',
    '',
    '/**',
    ' * Creates a support ticket in the external ticketing system.',
    ' */',
    'export const createTicket = defineStep({',
    '  name: "create_ticket",',
    '  description: "Create a support ticket in Zendesk/Jira",',
    '  input: z.object({',
    '    reason: z.string(),',
    '    userText: z.string(),',
    '    priority: z.enum(["low", "medium", "high", "urgent"]),',
    '    userId: z.string(),',
    '  }),',
    '  output: z.object({',
    '    id: z.string(),',
    '    url: z.string(),',
    '    status: z.string(),',
    '  }),',
    '  async handler(ctx, { reason, userText, priority, userId }) {',
    '    // In production, this calls Zendesk/Jira API',
    '    // For now, simulate ticket creation',
    '    const ticketId = "TKT-" + Date.now();',
    '',
    '    ctx.log.info("Creating ticket " + ticketId + " with priority " + priority);',
    '',
    '    // Store ticket reference for later lookup',
    '    await ctx.storage.put("ticket:" + ticketId, {',
    '      reason,',
    '      userText,',
    '      priority,',
    '      userId,',
    '      createdAt: ctx.date.toISOString(),',
    '    });',
    '',
    '    return {',
    '      id: ticketId,',
    '      url: "https://support.example.com/tickets/" + ticketId,',
    '      status: "open",',
    '    };',
    '  },',
    '});',
  ].join("\n");

  // Search FAQ step
  const searchFaqStep = [
    'import { defineStep, z } from "@kalphq/sdk";',
    '',
    '/**',
    ' * Searches the FAQ database for answers.',
    ' */',
    'export const searchFaq = defineStep({',
    '  name: "search_faq",',
    '  description: "Search FAQ database for relevant answers",',
    '  input: z.object({ query: z.string() }),',
    '  output: z.object({',
    '    found: z.boolean(),',
    '    answer: z.string(),',
    '    confidence: z.number(),',
    '  }),',
    '  async handler(ctx, { query }) {',
    '    // Use AI to match query to FAQ entries',
    '    const result = await ctx.ai.classify({',
    '      input: query,',
    '      labels: [',
    '        "pricing",',
    '        "refund",',
    '        "account",',
    '        "technical",',
    '        "none",',
    '      ],',
    '    });',
    '',
    '    const faqDatabase: Record<string, string> = {',
    '      pricing: "Our pricing starts at $10/month for the Starter plan.",',
    '      refund: "We offer a 30-day money-back guarantee, no questions asked.",',
    '      account: "You can manage your account settings in the dashboard.",',
    '      technical: "Please try clearing your cache and cookies first.",',
    '    };',
    '',
    '    if (result !== "none" && faqDatabase[result]) {',
    '      return {',
    '        found: true,',
    '        answer: faqDatabase[result],',
    '        confidence: 0.9,',
    '      };',
    '    }',
    '',
    '    return { found: false, answer: "", confidence: 0 };',
    '  },',
    '});',
  ].join("\n");

  // Draft response step
  const draftResponseStep = [
    'import { defineStep, z } from "@kalphq/sdk";',
    '',
    '/**',
    ' * Drafts a response for human approval.',
    ' */',
    'export const draftResponse = defineStep({',
    '  name: "draft_response",',
    '  description: "Draft a response for the user query",',
    '  input: z.object({ query: z.string() }),',
    '  output: z.object({',
    '    response: z.string(),',
    '    suggestedActions: z.array(z.string()),',
    '  }),',
    '  async handler(ctx, { query }) {',
    '    const draft = await ctx.ai.generate({',
    '      model: "openai/gpt-4o-mini",',
    '      system: "You are a helpful support agent. Draft a professional, empathetic response.",',
    '      prompt: "Draft a response to: " + query,',
    '    });',
    '',
    '    return {',
    '      response: draft.text,',
    '      suggestedActions: ["escalate", "send_faq", "request_info"],',
    '    };',
    '  },',
    '});',
  ].join("\n");

  // Health route
  const healthRoute = [
    'import { defineRoute } from "@kalphq/sdk";',
    '',
    '/**',
    ' * Health check endpoint.',
    ' */',
    'export const healthRoute = defineRoute({',
    '  name: "health",',
    '  method: "GET",',
    '  path: "/health",',
    '  handler: async (req, res) => {',
    '    res.json({',
    '      status: "ok",',
    '      agent: "' + agentName + '",',
    '      timestamp: new Date().toISOString(),',
    '    });',
    '  },',
    '});',
  ].join("\n");

  // Ticket webhook route - receives events from external ticketing system
  const ticketWebhookRoute = [
    'import { defineRoute } from "@kalphq/sdk";',
    '',
    '/**',
    ' * Webhook endpoint for ticket resolution events.',
    ' *',
    ' * When a human resolves a ticket in Zendesk/Jira, this endpoint',
    ' * receives the webhook and emits the event to wake up the paused agent.',
    ' */',
    'export const ticketWebhookRoute = defineRoute({',
    '  name: "ticket_webhook",',
    '  method: "POST",',
    '  path: "/webhooks/ticket-resolved",',
    '  handler: async (req, res) => {',
    '    // Parse webhook payload from Zendesk/Jira',
    '    const body = await req.json();',
    '    const ticketId = body.ticketId;',
    '    const resolution = body.resolution;',
    '',
    '    if (!ticketId) {',
    '      return res.status(400).json({ error: "Missing ticketId" });',
    '    }',
    '',
    '    // Emit event to wake up the paused agent',
    '    // This triggers waitForEvent("ticket_resolved_" + ticketId)',
    '    req.ctx.actions.emit("ticket_resolved_" + ticketId, {',
    '      resolution: resolution || "Issue resolved by support team",',
    '      resolvedAt: new Date().toISOString(),',
    '      resolvedBy: body.agentName || "support-agent",',
    '    });',
    '',
    '    res.json({ received: true, ticketId });',
    '  },',
    '});',
  ].join("\n");

  // Hooks
  const onInitHook = [
    '/**',
    ' * Runs when the agent starts up.',
    ' * Load FAQ index and initialize connections.',
    ' */',
    'export async function onInit(): Promise<void> {',
    '  // TODO: Load FAQ embeddings, connect to Zendesk API, etc.',
    '}',
  ].join("\n");

  const onTickHook = [
    '/**',
    ' * Runs periodically (if cron is configured).',
    ' * Check for SLA breaches or stale tickets.',
    ' */',
    'export async function onTick(): Promise<void> {',
    '  // TODO: Check for tickets nearing SLA breach',
    '}',
  ].join("\n");

  // Contract
  const contractFile = [
    'import { defineContract, z } from "@kalphq/sdk";',
    '',
    '/**',
    ' * Contract for external ticket systems to interact with the support agent.',
    ' */',
    'export const supportContract = defineContract({',
    '  name: "support",',
    '  input: z.object({',
    '    query: z.string(),',
    '    userId: z.string(),',
    '    priority: z.enum(["low", "medium", "high"]).default("medium"),',
    '  }),',
    '  output: z.object({',
    '    response: z.string(),',
    '    ticketId: z.string().optional(),',
    '    escalated: z.boolean(),',
    '  }),',
    '});',
  ].join("\n");

  // Write all files
  await writeTemplateFile(agentDir, "index.ts", agentIndex);
  await writeTemplateFile(join(agentDir, "steps"), "create-ticket.ts", createTicketStep);
  await writeTemplateFile(join(agentDir, "steps"), "search-faq.ts", searchFaqStep);
  await writeTemplateFile(join(agentDir, "steps"), "draft-response.ts", draftResponseStep);
  await writeTemplateFile(join(agentDir, "routes"), "health.ts", healthRoute);
  await writeTemplateFile(join(agentDir, "routes"), "ticket-webhook.ts", ticketWebhookRoute);
  await writeTemplateFile(join(agentDir, "hooks"), "onInit.ts", onInitHook);
  await writeTemplateFile(join(agentDir, "hooks"), "onTick.ts", onTickHook);
  await writeTemplateFile(join(agentDir, "contract"), "support-contract.ts", contractFile);
}

/**
 * Support template definition.
 */
export const supportTemplate: TemplateDefinition = {
  id: "support",
  name: "Support Agent",
  description: "Human-in-the-Loop with waitForEvent - pause for days until human resolves",
  icon: "🎧",
  generate: generateSupport,
};
