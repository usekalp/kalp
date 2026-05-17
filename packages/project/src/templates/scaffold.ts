/**
 * Agent scaffolding with template support.
 *
 * @module
 */

import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { TemplateId } from "./types";
import { getTemplate } from "./index";
import { deriveLabelFromName } from "../labels";

export interface ScaffoldAgentOptions {
  agentName: string;
  cwd: string;
  template?: TemplateId;
  label?: string;
}

export async function scaffoldAgent(opts: ScaffoldAgentOptions): Promise<void> {
  const { agentName, cwd, template } = opts;
  const agentLabel = opts.label?.trim() || deriveLabelFromName(agentName);

  if (template) {
    const templateDef = getTemplate(template);
    if (!templateDef) {
      throw new Error(`Unknown template: ${template}`);
    }
    await templateDef.generate({ agentName, cwd, label: agentLabel });
    return;
  }

  const agentDir = join(cwd, "agents", agentName);
  await mkdir(join(agentDir, "tools"), { recursive: true });
  await mkdir(join(agentDir, "hooks"), { recursive: true });
  await mkdir(join(agentDir, "contracts"), { recursive: true });

  const indexFile = `import { defineAgent } from "@kalphq/sdk";
import { agentState } from "./state";
import { messageHook } from "./hooks/message";
import { agentContract } from "./contracts/agent-contract";

export default defineAgent({
  name: "${agentName}",
  label: "${agentLabel}",
  description: "Generated Kalp vNext agent",
  state: agentState,
  contracts: [agentContract],
  hooks: [messageHook],
});
`;

  const stateFile = `import { z } from "zod";
export const agentState = z.object({ processedCount: z.number().default(0) });
export type AgentState = z.infer<typeof agentState>;
`;

  const toolFile = `import { defineTool } from "@kalphq/sdk";
import { z } from "zod";

export const exampleTool = defineTool({
  id: "example_tool",
  inputSchema: z.object({ text: z.string() }),
  async handler({ text }) {
    return { summary: text.toUpperCase() };
  },
});
`;

  const hookFile = `import { defineHook } from "@kalphq/sdk";
import type { AgentState } from "../state";
import { exampleTool } from "../tools/example-tool";

export const messageHook = defineHook<AgentState>({
  type: "message",
  async handler(message, ctx) {
    const result = await ctx.actions.run(exampleTool, { text: message.text });
    ctx.state.processedCount += 1;
    return { text: result.summary };
  },
});
`;

  const contractFile = `import { defineContract } from "@kalphq/sdk";
import { z } from "zod";
import type { AgentState } from "../state";

export const agentContract = defineContract<AgentState>({
  name: "${agentName}",
  inputSchema: z.object({ action: z.string() }),
  outputSchema: z.object({ ok: z.boolean() }),
  async handler() {
    return { ok: true };
  },
});
`;

  await writeFile(join(agentDir, "index.ts"), indexFile, "utf-8");
  await writeFile(join(agentDir, "state.ts"), stateFile, "utf-8");
  await writeFile(join(agentDir, "tools", "example-tool.ts"), toolFile, "utf-8");
  await writeFile(join(agentDir, "hooks", "message.ts"), hookFile, "utf-8");
  await writeFile(join(agentDir, "contracts", "agent-contract.ts"), contractFile, "utf-8");
}
