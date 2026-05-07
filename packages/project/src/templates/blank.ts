/**
 * Blank template - minimal structure for a Kalp agent.
 *
 * @module
 */

import { join } from "node:path";
import type { TemplateDefinition } from "./types";
import { writeTemplateFile } from "./utils";

/**
 * Generate the blank agent template.
 */
async function generateBlank(opts: {
  agentName: string;
  cwd: string;
}): Promise<void> {
  const { agentName, cwd } = opts;
  const agentDir = join(cwd, "agents", agentName);

  // Main agent file
  const agentIndex = [
    'import { defineAgent } from "@kalphq/sdk";',
    'import { onInit } from "./hooks/onInit";',
    'import { onTick } from "./hooks/onTick";',
    'import { exampleContract } from "./contract/example-contract";',
    'import { healthRoute } from "./routes/health";',
    "",
    "/**",
    " * A blank agent ready for your custom logic.",
    " */",
    "export default defineAgent({",
    '  name: "' + agentName + '",',
    '  description: "A helpful AI assistant",',
    "",
    "  contract: exampleContract,",
    "",
    "  systemPrompt: () => {",
    '    return "You are a helpful AI assistant. Answer questions and help users with their tasks.";',
    "  },",
    "",
    "  onInit,",
    "  onTick,",
    "",
    "  onCall: async (input, ctx) => {",
    "    return { success: true };",
    "  },",
    "",
    "  routes: [healthRoute],",
    "",
    "  async onMessage(message, ctx) {",
    "    // Access the message directly",
    "    const userText = message.text;",
    "",
    "    // TODO: Implement your agent logic here",
    "",
    '    return { text: "" };',
    "  },",
    "});",
  ].join("\n");

  // Step: example
  const exampleStep = [
    'import { defineStep, z } from "@kalphq/sdk";',
    "",
    "/**",
    " * An example step that processes text and returns the uppercase version.",
    " */",
    "export const exampleStep = defineStep({",
    '  id: "example_step",',
    '  description: "An example step that processes text",',
    "  inputSchema: z.object({ text: z.string() }),",
    "  outputSchema: z.object({ processed: z.string() }),",
    "  handler: async ({ text }, ctx) => {",
    "    // Process the text",
    "",
    "    return { processed: text.toUpperCase() };",
    "  },",
    "});",
  ].join("\n");

  // Tool: example
  const exampleTool = [
    'import { defineTool, z } from "@kalphq/sdk";',
    "",
    "/**",
    " * An example tool that searches for documentation.",
    " */",
    "export const exampleTool = defineTool({",
    '  id: "example_tool",',
    '  description: "An example tool that returns empty results",',
    "  inputSchema: z.object({ query: z.string() }),",
    "  handler: async ({ query }, ctx) => {",
    '    ctx.log.info("Query: " + query);',
    "    // TODO: Implement tool logic",
    "",
    "    return { results: [] };",
    "  },",
    "});",
  ].join("\n");

  // Route: health check
  const healthRoute = [
    'import { defineRoute } from "@kalphq/sdk";',
    "",
    "/**",
    " * Health check endpoint.",
    " */",
    "export const healthRoute = defineRoute({",
    '  id: "health",',
    '  method: "GET",',
    '  path: "/health",',
    "  handler: async (req, res, ctx) => {",
    "    res.json({",
    '      status: "ok",',
    '      agent: "' + agentName + '",',
    "      timestamp: ctx.date.toISOString(),",
    "    });",
    "  },",
    "});",
  ].join("\n");

  // Hook: onInit
  const onInitHook = [
    'import { HandlerContext } from "@kalphq/sdk";',
    "",
    "/**",
    " * Runs when the agent starts up.",
    " * Initialize any required state here.",
    " */",
    "export async function onInit(ctx: HandlerContext): Promise<void> {",
    "  // TODO: Add initialization logic",
    "  // Example: Load configuration, warm up caches, connect to databases",
    "}",
  ].join("\n");

  // Hook: onTick
  const onTickHook = [
    'import { HandlerContext } from "@kalphq/sdk";',
    "",
    "/**",
    " * Runs periodically to perform background tasks.",
    " * Configure the schedule in kalp.config.ts",
    " */",
    "export async function onTick(ctx: HandlerContext): Promise<void> {",
    "  // TODO: Add periodic task logic",
    "}",
  ].join("\n");

  // Contract: example
  const contractFile = [
    'import { defineContract, z } from "@kalphq/sdk";',
    "",
    "/**",
    " * Contract for external systems to call this agent.",
    " */",
    'export const exampleContract = defineContract("example", {',
    "  input: z.object({",
    "    action: z.string(),",
    "    data: z.record(z.unknown()),",
    "  }),",
    "  output: z.object({",
    "    success: z.boolean(),",
    "    result: z.unknown(),",
    "  }),",
    "});",
  ].join("\n");

  // Write all files
  await writeTemplateFile(agentDir, "index.ts", agentIndex);
  await writeTemplateFile(
    join(agentDir, "steps"),
    "example-step.ts",
    exampleStep,
  );
  await writeTemplateFile(
    join(agentDir, "tools"),
    "example-tool.ts",
    exampleTool,
  );
  await writeTemplateFile(join(agentDir, "routes"), "health.ts", healthRoute);
  await writeTemplateFile(join(agentDir, "hooks"), "onInit.ts", onInitHook);
  await writeTemplateFile(join(agentDir, "hooks"), "onTick.ts", onTickHook);
  await writeTemplateFile(
    join(agentDir, "contract"),
    "example-contract.ts",
    contractFile,
  );
}

/**
 * Blank template definition.
 */
export const blankTemplate: TemplateDefinition = {
  id: "blank",
  name: "Blank",
  description: "Minimal structure to start building your agent",
  icon: "⬜",
  generate: generateBlank,
};
