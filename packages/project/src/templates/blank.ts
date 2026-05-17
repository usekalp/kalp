import { join } from "node:path";
import type { TemplateDefinition } from "./types";
import { writeTemplateFile } from "./utils";

async function generateBlank(opts: { agentName: string; cwd: string; label?: string }): Promise<void> {
  const { agentName, cwd } = opts;
  const agentDir = join(cwd, "agents", agentName);

  const stateFile = `import { z } from "zod";

export const agentState = z.object({
  status: z.enum(["idle", "processing"]).default("idle"),
  processedCount: z.number().default(0),
});

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

  const contractFile = `import { defineContract } from "@kalphq/sdk";
import { z } from "zod";
import type { AgentState } from "../state";

export const exampleContract = defineContract<AgentState>({
  name: "${agentName}",
  inputSchema: z.object({ action: z.string() }),
  outputSchema: z.object({ ok: z.boolean() }),
  async handler() {
    return { ok: true };
  },
});
`;

  const messageHook = `import { defineHook } from "@kalphq/sdk";
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

  const routeFile = `import { defineRoute } from "@kalphq/sdk";
import type { AgentState } from "../state";

export const healthRoute = defineRoute<AgentState>({
  id: "health",
  method: "GET",
  path: "/health",
  async handler() {
    return { ok: true };
  },
});
`;

  const agentIndex = `import { defineAgent } from "@kalphq/sdk";
import { agentState } from "./state";
import { healthRoute } from "./routes/health";
import { exampleContract } from "./contracts/example-contract";
import { messageHook } from "./hooks/message";

export default defineAgent({
  name: "${agentName}",
  label: "${opts.label ?? agentName}",
  description: "A blank vNext Kalp agent.",
  state: agentState,
  routes: [healthRoute],
  contracts: [exampleContract],
  hooks: [messageHook],
});
`;

  await writeTemplateFile(agentDir, "index.ts", agentIndex);
  await writeTemplateFile(agentDir, "state.ts", stateFile);
  await writeTemplateFile(join(agentDir, "tools"), "example-tool.ts", toolFile);
  await writeTemplateFile(join(agentDir, "hooks"), "message.ts", messageHook);
  await writeTemplateFile(join(agentDir, "routes"), "health.ts", routeFile);
  await writeTemplateFile(join(agentDir, "contracts"), "example-contract.ts", contractFile);
}

export const blankTemplate: TemplateDefinition = {
  id: "blank",
  name: "Blank",
  description: "Minimal vNext structure with state, hooks, contracts and tools",
  icon: "⬜",
  generate: generateBlank,
};
