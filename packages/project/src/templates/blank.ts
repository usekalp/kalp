/**
 * Blank template - minimal structure with modern Kalp v1 syntax.
 *
 * Uses autodiscovery (no explicit IDs) and clean handler signatures.
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

  // Main agent file - minimal with modern syntax
  const agentIndex = [
    'import { defineAgent } from "@kalphq/sdk";',
    'import { healthRoute } from "./routes/health";',
    "",
    "/**",
    " * A blank agent with modern Kalp v1 syntax.",
    " *",
    " * This template uses:",
    " * - Autodiscovery (no explicit IDs in defineStep/defineTool)",
    " * - Modern handler signatures with ctx as first param",
    ' * - Server-side ID generation from the "name" field',
    " */",
    "export default defineAgent({",
    '  name: "' + agentName + '",',
    '  description: "A helpful AI assistant",',
    "",
    "  routes: [healthRoute],",
    "",
    "  async onMessage(ctx) {",
    "    // Access the message via ctx.message",
    "    const userText = ctx.message.text;",
    "",
    "    // TODO: Implement your agent logic here",
    "    // Available: ctx.actions.run(), ctx.ai.generate(), ctx.storage.put(), etc.",
    "",
    '    return { text: "" };',
    "  },",
    "});",
  ].join("\n");

  // Example step with modern syntax (no 'id', uses 'name')
  const exampleStep = [
    'import { defineStep, z } from "@kalphq/sdk";',
    "",
    "/**",
    " * An example step showing modern Kalp v1 syntax.",
    " *",
    ' * Note: We use "name" (not "id") and "input"/"output" (not "inputSchema"/"outputSchema").',
    " * The ID is auto-generated server-side from the kebab-case version of the name.",
    " */",
    "export const exampleStep = defineStep({",
    '  name: "example_step",',
    '  description: "An example step",',
    "  input: z.object({ text: z.string() }),",
    "  output: z.object({ processed: z.string() }),",
    "  async handler(ctx, { text }) {",
    "    // ctx provides access to all primitives",
    '    ctx.log.info("Processing: " + text);',
    "",
    "    return { processed: text.toUpperCase() };",
    "  },",
    "});",
  ].join("\n");

  // Example tool with modern syntax
  const exampleTool = [
    'import { defineTool, z } from "@kalphq/sdk";',
    "",
    "/**",
    " * An example tool showing modern Kalp v1 syntax.",
    " */",
    "export const exampleTool = defineTool({",
    '  name: "example_tool",',
    '  description: "An example tool that returns empty results",',
    "  input: z.object({ query: z.string() }),",
    "  output: z.object({ results: z.array(z.string()) }),",
    "  async handler(ctx, { query }) {",
    "    // TODO: Implement tool logic",
    "    // Example: Call external API, search database, etc.",
    "",
    "    return { results: [] };",
    "  },",
    "});",
  ].join("\n");

  // Health route
  const healthRoute = [
    'import { defineRoute } from "@kalphq/sdk";',
    "",
    "/**",
    " * Health check endpoint.",
    " */",
    "export const healthRoute = defineRoute({",
    '  name: "health",',
    '  method: "GET",',
    '  path: "/health",',
    "  handler: async (req, res) => {",
    "    res.json({",
    '      status: "ok",',
    '      agent: "' + agentName + '",',
    "      timestamp: new Date().toISOString(),",
    "    });",
    "  },",
    "});",
  ].join("\n");

  // Empty hooks with proper return types
  const onInitHook = [
    "/**",
    " * Runs when the agent starts up.",
    " * Initialize any required state here.",
    " */",
    "export async function onInit(): Promise<void> {",
    "  // TODO: Add initialization logic",
    "  // Example: Load configuration, warm up caches, connect to databases",
    "}",
  ].join("\n");

  const onTickHook = [
    "/**",
    " * Runs periodically if cron is configured in defineAgent.",
    " * Check schedules or perform background tasks.",
    " */",
    "export async function onTick(): Promise<void> {",
    "  // TODO: Add periodic task logic",
    "}",
  ].join("\n");

  const onCallHook = [
    'import type { HandlerContext } from "@kalphq/sdk";',
    "",
    "/**",
    " * Runs when the agent is called via its contract (RPC).",
    " * Implement RPC methods here.",
    " */",
    "export async function onCall(ctx: HandlerContext): Promise<unknown> {",
    "  // TODO: Implement RPC handling",
    "  return { success: true };",
    "}",
  ].join("\n");

  // Contract placeholder
  const contractFile = [
    'import { defineContract, z } from "@kalphq/sdk";',
    "",
    "/**",
    " * Contract for external systems to call this agent via RPC.",
    " *",
    " * Uncomment and modify to enable RPC calls to this agent.",
    " */",
    "export const exampleContract = defineContract({",
    '  name: "example",',
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
  await writeTemplateFile(join(agentDir, "hooks"), "onCall.ts", onCallHook);
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
  description:
    "Minimal structure with modern Kalp v1 syntax (autodiscovery, no explicit IDs)",
  icon: "⬜",
  generate: generateBlank,
};
