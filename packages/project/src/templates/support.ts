/**
 * Support agent template - customer support with human escalation.
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
  label?: string;
}): Promise<void> {
  const { agentName, cwd } = opts;
  const agentDir = join(cwd, "agents", agentName);
 
  // Derive contract name from agent name (e.g. "my-agent" -> "MyAgent")
  const contractName = agentName
    .replace(/-+(.)/g, (_, char: string) => char.toUpperCase())
    .replace(/^./, (char: string) => char.toUpperCase());

  // Main agent file with waitForEvent magic
  const agentIndex = [
    'import { defineAgent } from "@kalphq/sdk";',
    'import { createTicket } from "./steps/create-ticket";',
    'import { searchFaq } from "./steps/search-faq";',
    'import { draftResponse } from "./steps/draft-response";',
    'import { healthRoute } from "./routes/health";',
    'import { ticketWebhookRoute } from "./routes/ticket-webhook";',
    'import { onInit } from "./hooks/onInit";',
    'import { onTick } from "./hooks/onTick";',
    'import { ' + contractName + 'Contract } from "./contract/' + agentName + '-contract";',
    "",
    "/**",
    " * Support agent that escalates frustrated customers to human agents.",
    " *",
    " * When negative sentiment is detected:",
    " * 1. Creates a support ticket in external system",
    " * 2. Pauses and waits for human resolution",
    " * 3. Resumes when ticket is resolved to notify customer",
    " */",
    "export default defineAgent({",
    '  name: "' + agentName + '",',
    '  label: "' + (opts.label ?? agentName) + '",',
    '  description: "Customer support with true Human-in-the-loop escalation",',
    "",
    "  contract: " + contractName + "Contract,",
    "",
    "  systemPrompt: () => {",
    '    return "You are a customer support agent. Help customers with their issues and escalate to human agents when necessary.";',
    "  },",
    "",
    "  onInit,",
    "  onTick,",
    "  routes: [healthRoute, ticketWebhookRoute],",
    "",
    "  async onMessage(message, ctx) {",
    "    // Analyze sentiment to detect frustrated customers",
    "    const sentiment = await ctx.ai.classify({",
    "      input: message.text,",
    '      labels: ["angry", "frustrated", "neutral", "happy"],',
    "    });",
    "",
    '    if (sentiment === "angry" || sentiment === "frustrated") {',
    "      // Create support ticket in external system",
    "      const ticket = await ctx.actions.run(createTicket, {",
    '        reason: "Negative sentiment detected",',
    "        userText: message.text,",
    '        priority: "high",',
    "        userId: ctx.auth?.userId || '',",
    "      });",
    "      // Pause until human resolves the ticket",
    "      const wakeReason = await ctx.actions.waitForEvent(",
    '        "ticket_resolved_" + ticket.id,',
    '        "7d"',
    "      );",
    "      // Resume and notify customer of resolution",
    '      if (wakeReason.type === "event") {',
    "        return {",
    '          text: "Hi! Our manager reviewed your case and resolved it: " + wakeReason.payload + ". Is there anything else I can help with?",',
    "        };",
    "      }",
    "",
    '      return { text: "Your case is being handled by our team. You will hear back soon." };',
    "    }",
    "    // Try FAQ lookup first",
    "    const faqResult = await ctx.actions.run(searchFaq, { query: message.text });",
    "    if (faqResult.found) {",
    "      return { text: faqResult.answer };",
    "    }",
    "    // No FAQ match - draft a response",
    "    const draft = await ctx.actions.run(draftResponse, { query: message.text });",
    "    return { text: draft.response, data: { needsApproval: true } };",
    "  },",
    "});",
  ].join("\n");

  // Step: create ticket
  const createTicketStep = [
    'import { bindContract, z } from "@kalphq/sdk";',
    'import { ' + contractName + 'Contract } from "../contract/' + agentName + '-contract";',
    "",
    "const { defineStep } = bindContract(" + contractName + "Contract);",
    "",
    "/**",
    " * Creates a support ticket in the external ticketing system.",
    " */",
    "export const createTicket = defineStep({",
    '  id: "create_ticket",',
    '  description: "Create a support ticket in Zendesk/Jira",',
    "  inputSchema: z.object({",
    "    reason: z.string(),",
    "    userText: z.string(),",
    '    priority: z.enum(["low", "medium", "high", "urgent"]),',
    "    userId: z.string(),",
    "  }),",
    "  outputSchema: z.object({",
    "    id: z.string(),",
    "    url: z.string(),",
    "    status: z.string(),",
    "  }),",
    "  handler: async ({ reason, userText, priority, userId }, ctx) => {",
    "    // Create ticket in external system",
    '    const ticketId = "TKT-" + Date.now();',
    "",
    '    ctx.log.info("Creating ticket " + ticketId + " with priority " + priority);',
    "    // Store ticket reference",
    '    await ctx.storage.put("ticket:" + ticketId, {',
    "      reason,",
    "      userText,",
    "      priority,",
    "      userId,",
    "      createdAt: ctx.date.toISOString(),",
    "    });",
    "",
    "    return {",
    "      id: ticketId,",
    '      url: "https://support.example.com/tickets/" + ticketId,',
    '      status: "open",',
    "    };",
    "  },",
    "});",
  ].join("\n");

  // Step: search FAQ
  const searchFaqStep = [
    'import { bindContract, z } from "@kalphq/sdk";',
    'import { ' + contractName + 'Contract } from "../contract/' + agentName + '-contract";',
    "",
    "const { defineStep } = bindContract(" + contractName + "Contract);",
    "",
    "/**",
    " * Searches the FAQ database for answers.",
    " */",
    "export const searchFaq = defineStep({",
    '  id: "search_faq",',
    '  description: "Search FAQ database for relevant answers",',
    "  inputSchema: z.object({ query: z.string() }),",
    "  outputSchema: z.object({",
    "    found: z.boolean(),",
    "    answer: z.string(),",
    "    confidence: z.number(),",
    "  }),",
    "  handler: async ({ query }, ctx) => {",
    "    // Match query to FAQ entries",
    "    const result = await ctx.ai.classify({",
    "      input: query,",
    "      labels: [",
    '        "pricing",',
    '        "refund",',
    '        "account",',
    '        "technical",',
    '        "none",',
    "      ],",
    "    });",
    "",
    "    const faqDatabase: Record<string, string> = {",
    '      pricing: "Our pricing starts at $10/month for the Starter plan.",',
    '      refund: "We offer a 30-day money-back guarantee, no questions asked.",',
    '      account: "You can manage your account settings in the dashboard.",',
    '      technical: "Please try clearing your cache and cookies first.",',
    "    };",
    "",
    '    if (result !== "none" && faqDatabase[result]) {',
    "      return {",
    "        found: true,",
    "        answer: faqDatabase[result],",
    "        confidence: 0.9,",
    "      };",
    "    }",
    "",
    '    return { found: false, answer: "", confidence: 0 };',
    "  },",
    "});",
  ].join("\n");

  // Step: draft response
  const draftResponseStep = [
    'import { bindContract, z } from "@kalphq/sdk";',
    'import { ' + contractName + 'Contract } from "../contract/' + agentName + '-contract";',
    "",
    "const { defineStep } = bindContract(" + contractName + "Contract);",
    "",
    "/**",
    " * Drafts a response for human approval.",
    " */",
    "export const draftResponse = defineStep({",
    '  id: "draft_response",',
    '  description: "Draft a response for the user query",',
    "  inputSchema: z.object({ query: z.string() }),",
    "  outputSchema: z.object({",
    "    response: z.string(),",
    "    suggestedActions: z.array(z.string()),",
    "  }),",
    "  handler: async ({ query }, ctx) => {",
    "    const draft = await ctx.ai.generate({",
    '      model: "openai/gpt-4o-mini",',
    '      system: "You are a helpful support agent. Draft a professional, empathetic response.",',
    '      prompt: "Draft a response to: " + query,',
    "    });",
    "",
    "    return {",
    "      response: draft,",
    '      suggestedActions: ["escalate", "send_faq", "request_info"],',
    "    };",
    "  },",
    "});",
  ].join("\n");

  // Route: health check
  const healthRoute = [
    'import { bindContract } from "@kalphq/sdk";',
    'import { ' + contractName + 'Contract } from "../contract/' + agentName + '-contract";',
    "",
    "const { defineRoute } = bindContract(" + contractName + "Contract);",
    "",
    "/**",
    " * Health check endpoint.",
    " */",
    "export const healthRoute = defineRoute({",
    '  id: "health",',
    '  method: "GET",',
    '  path: "/health",',
    "  handler: async ({ res, ctx }) => {",
    "    res.json({",
    '      status: "ok",',
    '      agent: "' + agentName + '",',
    "      timestamp: ctx.date.toISOString(),",
    "    });",
    "  },",
    "});",
  ].join("\n");

  // Route: ticket webhook
  const ticketWebhookRoute = [
    'import { bindContract, z } from "@kalphq/sdk";',
    'import { ' + contractName + 'Contract } from "../contract/' + agentName + '-contract";',
    "",
    "const { defineRoute } = bindContract(" + contractName + "Contract);",
    "",
    "/**",
    " * Webhook endpoint for ticket resolution events.",
    " *",
    " * When a human resolves a ticket in Zendesk/Jira, this endpoint",
    " * notifies the agent to resume the conversation.",
    " */",
    "export const ticketWebhookRoute = defineRoute({",
    '  id: "ticket_webhook",',
    '  method: "POST",',
    '  path: "/webhooks/ticket-resolved",',
    '  inputSchema: z.object({',
    '    ticketId: z.string(),',
    '    resolution: z.string().optional(),',
    '    agentName: z.string().optional(),',
    '  }),',
    "",
    "  handler: async ({ res, body, ctx }) => {",
    "    // Emit event to notify the agent",
    '    ctx.actions.emit("ticket_resolved_" + body.ticketId, {',
    '      resolution: body.resolution || "Issue resolved by support team",',
    "      resolvedAt: ctx.date.toISOString(),",
    '      resolvedBy: body.agentName || "support-agent",',
    "    });",
    "",
    "    res.json({ received: true, ticketId });",
    "  },",
    "});",
  ].join("\n");

  // Hook: onInit
  const onInitHook = [
    'import { TypedKalpContext } from "@kalphq/sdk";',
    'import { ' + contractName + 'Contract } from "../contract/' + agentName + '-contract";',
    "",
    "/**",
    " * Runs when the agent starts up.",
    " * Load FAQ index and initialize connections.",
    " */",
    "export async function onInit(ctx: TypedKalpContext<typeof " + contractName + "Contract>): Promise<void> {",
    "  // TODO: Load FAQ embeddings, connect to Zendesk API, etc.",
    "}",
  ].join("\n");

  // Hook: onTick
  const onTickHook = [
    'import { TypedKalpContext } from "@kalphq/sdk";',
    'import { ' + contractName + 'Contract } from "../contract/' + agentName + '-contract";',
    "",
    "/**",
    " * Runs periodically to check for SLA breaches or stale tickets.",
    " * Configure the schedule in kalp.config.ts",
    " */",
    "export async function onTick(ctx: TypedKalpContext<typeof " + contractName + "Contract>): Promise<void> {",
    "  // TODO: Check for tickets nearing SLA breach",
    "}",
  ].join("\n");

  // Contract: support
  const contractFile = [
    'import { defineContract, z } from "@kalphq/sdk";',
    "",
    "/**",
    " * Contract for external ticket systems to interact with the support agent.",
    " */",
    'export const ' + contractName + 'Contract = defineContract("' + agentName + '", {',
    "  input: z.object({",
    "    query: z.string(),",
    "    userId: z.string(),",
    '    priority: z.enum(["low", "medium", "high"]).default("medium"),',
    "  }),",
    "  output: z.object({",
    "    response: z.string(),",
    "    ticketId: z.string().optional(),",
    "    escalated: z.boolean(),",
    "  }),",
    "});",
  ].join("\n");

  // Write all files
  await writeTemplateFile(agentDir, "index.ts", agentIndex);
  await writeTemplateFile(
    join(agentDir, "steps"),
    "create-ticket.ts",
    createTicketStep,
  );
  await writeTemplateFile(
    join(agentDir, "steps"),
    "search-faq.ts",
    searchFaqStep,
  );
  await writeTemplateFile(
    join(agentDir, "steps"),
    "draft-response.ts",
    draftResponseStep,
  );
  await writeTemplateFile(join(agentDir, "routes"), "health.ts", healthRoute);
  await writeTemplateFile(
    join(agentDir, "routes"),
    "ticket-webhook.ts",
    ticketWebhookRoute,
  );
  await writeTemplateFile(join(agentDir, "hooks"), "onInit.ts", onInitHook);
  await writeTemplateFile(join(agentDir, "hooks"), "onTick.ts", onTickHook);
  await writeTemplateFile(
    join(agentDir, "contract"),
    agentName + "-contract.ts",
    contractFile,
  );
}

/**
 * Support template definition.
 */
export const supportTemplate: TemplateDefinition = {
  id: "support",
  name: "Support Agent",
  description: "Customer support with human escalation for complex cases",
  icon: "🎧",
  generate: generateSupport,
};
