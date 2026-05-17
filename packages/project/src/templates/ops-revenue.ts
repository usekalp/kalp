import { join } from "node:path";
import type { TemplateDefinition } from "./types";
import { writeTemplateFile } from "./utils";

async function generateOpsRevenue(opts: { agentName: string; cwd: string; label?: string }): Promise<void> {
  const { agentName, cwd } = opts;
  const agentDir = join(cwd, "agents", agentName);

  const stateFile = `import { z } from "zod";
export const agentState = z.object({ processedCount: z.number().default(0) });
export type AgentState = z.infer<typeof agentState>;
`;

  const listenerFile = `import { defineListener } from "@kalphq/sdk";
import { z } from "zod";
import type { AgentState } from "../state";

export const approvalRequested = defineListener<AgentState>({
  event: "approval_requested",
  inputSchema: z.object({ score: z.number() }),
  outputSchema: z.object({ approved: z.boolean() }),
  async handler(payload) {
    return { approved: payload.score > 80 };
  },
});
`;

  const toolFile = `import { defineTool } from "@kalphq/sdk";
import { z } from "zod";

export const scoreOpportunity = defineTool({
  id: "score_opportunity",
  inputSchema: z.object({ transcript: z.string() }),
  async handler({ transcript }) {
    return { score: Math.min(99, transcript.length) };
  },
});
`;

  const contractFile = `import { defineContract } from "@kalphq/sdk";
import { z } from "zod";
import type { AgentState } from "../state";

export const revenueContract = defineContract<AgentState>({
  name: "${agentName}",
  inputSchema: z.object({ opportunityId: z.string() }),
  outputSchema: z.object({ ok: z.boolean() }),
  async handler() {
    return { ok: true };
  },
});
`;

  const hookFile = `import { defineHook } from "@kalphq/sdk";
import type { AgentState } from "../state";
import { scoreOpportunity } from "../tools/score-opportunity";
import { approvalRequested } from "../listeners/approval-requested";

export const messageHook = defineHook<AgentState>({
  type: "message",
  async handler(message, ctx) {
    const scored = await ctx.actions.run(scoreOpportunity, { transcript: message.text });
    const approval = await ctx.actions.emit(approvalRequested, { score: scored.score });
    ctx.state.processedCount += 1;
    return { text: approval.approved ? \`Approved: \${scored.score}\` : \`Review: \${scored.score}\` };
  },
});
`;

  const agentIndex = `import { defineAgent } from "@kalphq/sdk";
import { agentState } from "./state";
import { revenueContract } from "./contracts/revenue-contract";
import { messageHook } from "./hooks/message";

export default defineAgent({
  name: "${agentName}",
  label: "${opts.label ?? agentName}",
  description: "Revenue operations agent using contracts, tools and local listeners.",
  state: agentState,
  contracts: [revenueContract],
  hooks: [messageHook],
});
`;

  await writeTemplateFile(agentDir, "index.ts", agentIndex);
  await writeTemplateFile(agentDir, "state.ts", stateFile);
  await writeTemplateFile(join(agentDir, "listeners"), "approval-requested.ts", listenerFile);
  await writeTemplateFile(join(agentDir, "tools"), "score-opportunity.ts", toolFile);
  await writeTemplateFile(join(agentDir, "contracts"), "revenue-contract.ts", contractFile);
  await writeTemplateFile(join(agentDir, "hooks"), "message.ts", hookFile);
}

export const opsRevenueTemplate: TemplateDefinition = {
  id: "ops-revenue",
  name: "Ops Revenue",
  description: "Revenue ops agent using tools, contracts and local listeners",
  icon: "💼",
  generate: generateOpsRevenue,
};
