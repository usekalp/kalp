/**
 * Agent scaffolding with template support.
 *
 * @module
 */

import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { TemplateId } from "./types";
import { getTemplate } from "./index";

export interface ScaffoldAgentOptions {
  agentName: string;
  cwd: string;
  template?: TemplateId;
}

/**
 * Scaffolds a new agent with optional template.
 *
 * If a template is specified, uses the template's generate function.
 * Otherwise creates a minimal default agent.
 */
export async function scaffoldAgent(opts: ScaffoldAgentOptions): Promise<void> {
  const { agentName, cwd, template } = opts;

  // If template specified, use template generator
  if (template) {
    const templateDef = getTemplate(template);
    if (!templateDef) {
      throw new Error(`Unknown template: ${template}`);
    }
    await templateDef.generate({ agentName, cwd });
    return;
  }

  // Default minimal scaffold
  const agentDir = join(cwd, "agents", agentName);

  // Compute contract names
  const contractName = agentName
    .replace(/-([a-z])/g, (_, char: string) => char.toUpperCase())
    .replace(/^[a-z]/, (char: string) => char.toUpperCase());

  await mkdir(join(agentDir, "steps"), { recursive: true });
  await mkdir(join(agentDir, "tools"), { recursive: true });
  await mkdir(join(agentDir, "routes"), { recursive: true });
  await mkdir(join(agentDir, "hooks"), { recursive: true });
  await mkdir(join(agentDir, "contract"), { recursive: true });

  // Step: example
  const exampleStep = `import { defineStep, z } from "@kalphq/sdk";

/**
 * An example step that processes text.
 */
export const exampleStep = defineStep({
  id: "example_step",
  description: "An example step that processes text",
  inputSchema: z.object({ text: z.string() }),
  outputSchema: z.object({ processed: z.string() }),
  handler: ({ text }, ctx) => {
    ctx.log.info("Processing: " + text);
    return { processed: text.toUpperCase() };
  },
});
`;

  // Tool: example
  const exampleTool = `import { defineTool, z } from "@kalphq/sdk";

/**
 * An example tool that searches for documentation.
 */
export const exampleTool = defineTool({
  id: "example_tool",
  description: "An example tool that returns empty results",
  inputSchema: z.object({ query: z.string() }),
  handler: ({ query }, ctx) => {
    ctx.log.info("Query: " + query);
    // TODO: Search database or call external API

    return { results: [] };
  },
});
`;

  // Route: health check
  const healthRoute = `import { defineRoute } from "@kalphq/sdk";

/**
 * Health check endpoint.
 */
export const healthRoute = defineRoute({
  id: "health",
  method: "GET",
  path: "/health",
  handler: async (req, res, ctx) => {
    res.json({
      status: "ok",
      agent: "${agentName}",
      timestamp: ctx.date.toISOString(),
    });
  },
});
`;

  // Hook: onInit
  const onInitHook = `import { HandlerContext } from "@kalphq/sdk";

/**
 * Runs when the agent starts up.
 * Initialize any required state here.
 */
export async function onInit(ctx: HandlerContext): Promise<void> {
  // TODO: Add initialization logic
}
`;

  // Hook: onTick
  const onTickHook = `import { HandlerContext } from "@kalphq/sdk";

/**
 * Runs periodically to perform background tasks.
 * Configure the schedule in kalp.config.ts
 */
export async function onTick(ctx: HandlerContext): Promise<void> {
  // TODO: Add periodic task logic
}
`;

  // Contract: agent
  const contractFile = `import { defineContract, z } from "@kalphq/sdk";

/**
 * Contract for external systems to call this agent.
 */
export const ${agentName.replace(/-([a-z])/g, (_, char) => char.toUpperCase()).replace(/^[a-z]/, (char) => char.toUpperCase())}Contract = defineContract("${agentName}", {
  input: z.object({
    action: z.string(),
    data: z.record(z.unknown()),
  }),
  output: z.object({
    success: z.boolean(),
    result: z.unknown(),
  }),
});
`;

  // Agent index file
  const agentIndex = `import { defineAgent } from "@kalphq/sdk";
import { onInit } from "./hooks/onInit";
import { onTick } from "./hooks/onTick";
import { ${contractName}Contract } from "./contract/${agentName}-contract";
import { healthRoute } from "./routes/health";

export default defineAgent({
  name: "${agentName}",
  description: "A helpful AI assistant",

  contract: ${contractName}Contract,

  systemPrompt: () => {
    return "You are a helpful AI assistant. Answer questions and help users with their tasks.";
  },

  onInit,
  onTick,
  routes: [healthRoute],

  async onMessage(message, ctx) {
    return { text: "" };
  },
});`;

  await writeFile(
    join(agentDir, "steps", "example-step.ts"),
    exampleStep,
    "utf-8",
  );
  await writeFile(
    join(agentDir, "tools", "example-tool.ts"),
    exampleTool,
    "utf-8",
  );
  await writeFile(join(agentDir, "routes", "health.ts"), healthRoute, "utf-8");
  await writeFile(join(agentDir, "hooks", "onInit.ts"), onInitHook, "utf-8");
  await writeFile(join(agentDir, "hooks", "onTick.ts"), onTickHook, "utf-8");
  await writeFile(
    join(agentDir, "contract", "${agentName}-contract.ts"),
    contractFile,
    "utf-8",
  );
  await writeFile(join(agentDir, "index.ts"), agentIndex, "utf-8");
}
