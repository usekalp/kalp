import { join } from "node:path";
import type { TemplateDefinition } from "./types";
import { writeTemplateFile } from "./utils";

async function generateSupport(opts: { agentName: string; cwd: string; label?: string }): Promise<void> {
  const { agentName, cwd } = opts;
  const agentDir = join(cwd, "agents", agentName);

  const stateFile = `import { z } from "zod";
export const agentState = z.object({ ticketsHandled: z.number().default(0) });
export type AgentState = z.infer<typeof agentState>;
`;

  const listenerFile = `import { defineListener } from "@kalphq/sdk";
import { z } from "zod";
import type { AgentState } from "../state";

export const classifyTicket = defineListener<AgentState>({
  event: "classify_ticket",
  inputSchema: z.object({ urgency: z.number() }),
  outputSchema: z.object({ priority: z.enum(["low", "high"]) }),
  async handler(payload) {
    return { priority: payload.urgency > 7 ? "high" : "low" };
  },
});
`;

  const contractFile = `import { defineContract } from "@kalphq/sdk";
import { z } from "zod";
import type { AgentState } from "../state";

export const supportContract = defineContract<AgentState>({
  name: "${agentName}",
  inputSchema: z.object({ ticketId: z.string() }),
  outputSchema: z.object({ accepted: z.boolean() }),
  async handler(input) {
    return { accepted: Boolean(input.ticketId) };
  },
});
`;

  const hookFile = `import { defineHook } from "@kalphq/sdk";
import type { AgentState } from "../state";
import { classifyTicket } from "../listeners/classify-ticket";

export const messageHook = defineHook<AgentState>({
  type: "message",
  async handler(message, ctx) {
    const result = await ctx.actions.emit(classifyTicket, { urgency: message.text.length });
    ctx.state.ticketsHandled += 1;
    return { text: \`Priority: \${result.priority}\` };
  },
});
`;

  const agentIndex = `import { defineAgent } from "@kalphq/sdk";
import { agentState } from "./state";
import { supportContract } from "./contracts/support-contract";
import { messageHook } from "./hooks/message";

export default defineAgent({
  name: "${agentName}",
  label: "${opts.label ?? agentName}",
  description: "Support agent using local listeners and a public contract.",
  state: agentState,
  contracts: [supportContract],
  hooks: [messageHook],
});
`;

  await writeTemplateFile(agentDir, "index.ts", agentIndex);
  await writeTemplateFile(agentDir, "state.ts", stateFile);
  await writeTemplateFile(join(agentDir, "listeners"), "classify-ticket.ts", listenerFile);
  await writeTemplateFile(join(agentDir, "contracts"), "support-contract.ts", contractFile);
  await writeTemplateFile(join(agentDir, "hooks"), "message.ts", hookFile);
}

export const supportTemplate: TemplateDefinition = {
  id: "support",
  name: "Support",
  description: "Support agent using contracts and local listeners",
  icon: "🎧",
  generate: generateSupport,
};
