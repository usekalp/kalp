import { join } from "node:path";
import type { TemplateDefinition } from "./types";
import { writeTemplateFile } from "./utils";

async function generateResearcher(opts: { agentName: string; cwd: string; label?: string }): Promise<void> {
  const { agentName, cwd } = opts;
  const agentDir = join(cwd, "agents", agentName);

  const stateFile = `import { z } from "zod";
export const agentState = z.object({ draftsCreated: z.number().default(0) });
export type AgentState = z.infer<typeof agentState>;
`;

  const toolFile = `import { defineTool } from "@kalphq/sdk";
import { z } from "zod";

export const summarizeResearch = defineTool({
  id: "summarize_research",
  inputSchema: z.object({ topic: z.string() }),
  outputSchema: z.object({ summary: z.string() }),
  async handler({ topic }) {
    return { summary: \`Research summary for \${topic}\` };
  },
});
`;

  const cronFile = `import { defineCron, everySixHours } from "@kalphq/sdk";
import type { AgentState } from "../state";

export const refreshCron = defineCron<AgentState>({
  expression: everySixHours,
  timezone: "UTC",
  async handler(ctx) {
    ctx.state.draftsCreated += 1;
  },
});
`;

  const hookFile = `import { defineHook } from "@kalphq/sdk";
import type { AgentState } from "../state";
import { summarizeResearch } from "../tools/summarize-research";

export const messageHook = defineHook<AgentState>({
  type: "message",
  async handler(message, ctx) {
    const result = await ctx.actions.run(summarizeResearch, { topic: message.text });
    await ctx.actions.waitUntil(ctx.date.now() + 60_000);
    return { text: result.summary };
  },
});
`;

  const agentIndex = `import { defineAgent } from "@kalphq/sdk";
import { agentState } from "./state";
import { refreshCron } from "./crons/refresh";
import { messageHook } from "./hooks/message";

export default defineAgent({
  name: "${agentName}",
  label: "${opts.label ?? agentName}",
  description: "Research-focused agent with cron refreshes.",
  state: agentState,
  cron: [refreshCron],
  hooks: [messageHook],
});
`;

  await writeTemplateFile(agentDir, "index.ts", agentIndex);
  await writeTemplateFile(agentDir, "state.ts", stateFile);
  await writeTemplateFile(join(agentDir, "tools"), "summarize-research.ts", toolFile);
  await writeTemplateFile(join(agentDir, "crons"), "refresh.ts", cronFile);
  await writeTemplateFile(join(agentDir, "hooks"), "message.ts", hookFile);
}

export const researcherTemplate: TemplateDefinition = {
  id: "researcher",
  name: "Researcher",
  description: "Research workflow using tools, hooks, and cron refreshes",
  icon: "🔎",
  generate: generateResearcher,
};
