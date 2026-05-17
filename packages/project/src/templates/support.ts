import { join } from "node:path";
import type { TemplateDefinition } from "./types";
import { writeTemplateFile } from "./utils";

async function generateSupport(opts: {
  agentName: string;
  cwd: string;
  label?: string;
}): Promise<void> {
  const { agentName, cwd } = opts;
  const agentDir = join(cwd, "agents", agentName);

  const stateFile = `import { z } from "zod";

export const agentState = z.object({
  ticketsHandled: z.number().default(0),
  lastPriority: z.enum(["low", "high"]).default("low"),
});

export type AgentState = z.infer<typeof agentState>;
`;

  const toolFile = `import { defineToolFor } from "@kalphq/sdk";
import { z } from "zod";
import type { AgentState } from "../state";

export const draftReply = defineToolFor<AgentState>()({
  id: "draft_reply",
  inputSchema: z.object({
    issue: z.string(),
    priority: z.enum(["low", "high"]),
  }),
  outputSchema: z.object({ reply: z.string() }),
  async handler({ issue, priority }, ctx) {
    // Business intent: draft a customer-facing answer in consistent tone.
    const reply = await ctx.ai.generate({
      model: "gpt-4o-mini",
      system: "Draft concise support reply.",
      prompt: \`Priority: \${priority}\\nIssue: \${issue}\`,
    });

    return { reply };
  },
});
`;

  const listenerFile = `import { defineListenerFor } from "@kalphq/sdk";
import { z } from "zod";
import type { AgentState } from "../state";

export const classifyTicket = defineListenerFor<AgentState>()({
  event: "classify_ticket",
  inputSchema: z.object({ urgency: z.number() }),
  outputSchema: z.object({ priority: z.enum(["low", "high"]) }),
  async handler(payload, ctx) {
    // Business intent: map urgency to operational queue priority.
    ctx.state.lastPriority = payload.urgency > 7 ? "high" : "low";
    return { priority: ctx.state.lastPriority };
  },
});
`;

  const contractFile = `import { defineContractFor } from "@kalphq/sdk";
import { z } from "zod";
import type { AgentState } from "../state";

export const supportContract = defineContractFor<AgentState>()({
  name: "${agentName}",
  inputSchema: z.object({ ticketId: z.string() }),
  outputSchema: z.object({
    accepted: z.boolean(),
    note: z.string(),
  }),
  async handler(input, ctx) {
    // Business intent: external systems can register a new support intake.
    const note = await ctx.ai.generate({
      model: "gpt-4o-mini",
      system: "Generate short support intake note.",
      prompt: input.ticketId,
    });

    return { accepted: true, note };
  },
});
`;

  const cronFile = `import { defineCron, everySixHours } from "@kalphq/sdk";
import type { AgentState } from "../state";

export const backlogCron = defineCron<AgentState>({
  expression: everySixHours,
  timezone: "UTC",
  async handler(ctx) {
    // Business intent: scheduled reset when no tickets were processed.
    if (ctx.state.ticketsHandled === 0) {
      ctx.state.lastPriority = "low";
    }
  },
});
`;

  const routeFile = `import { defineRouteFor } from "@kalphq/sdk";
import { z } from "zod";
import type { AgentState } from "../state";

export const inboxRoute = defineRouteFor<AgentState>()({
  id: "inbox",
  method: "POST",
  path: "/inbox",
  inputSchema: z.object({ ticketId: z.string() }),
  outputSchema: z.object({
    ok: z.boolean(),
    ticketId: z.string().optional(),
    lastPriority: z.enum(["low", "high"]),
  }),
  async handler({ body, ctx }) {
    // Business intent: operational endpoint for ingestion/status checks.
    return {
      ok: true,
      ticketId: body?.ticketId,
      lastPriority: ctx.state.lastPriority,
    };
  },
});
`;

  const initHook = `import { defineHook } from "@kalphq/sdk";
import type { AgentState } from "../state";

export const initHook = defineHook<AgentState>({
  type: "init",
  async handler(ctx) {
    // Business intent: deterministic startup defaults.
    ctx.state.lastPriority = "low";
  },
});
`;

  const tickHook = `import { defineHook } from "@kalphq/sdk";
import type { AgentState } from "../state";

export const tickHook = defineHook<AgentState>({
  type: "tick",
  async handler(ctx) {
    // Business intent: escalation guard when queue volume grows.
    if (ctx.state.ticketsHandled > 100) {
      ctx.state.lastPriority = "high";
    }
  },
});
`;

  const messageHook = `import { defineHook } from "@kalphq/sdk";
import type { AgentState } from "../state";
import { classifyTicket } from "../listeners/classify-ticket";
import { draftReply } from "../tools/draft-reply";

export const messageHook = defineHook<AgentState>({
  type: "message",
  async handler(message, ctx) {
    // Business intent: classify ticket, draft reply, and persist counters.
    const classification = await ctx.actions.emit(classifyTicket, {
      urgency: Math.min(10, Math.ceil(message.text.length / 20)),
    });

    const drafted = await ctx.actions.run(draftReply, {
      issue: message.text,
      priority: classification.priority,
    });

    ctx.state.ticketsHandled += 1;
    return { text: drafted.reply };
  },
});
`;

  const index = `import { defineAgent } from "@kalphq/sdk";
import { agentState } from "./state";
import { supportContract } from "./contracts/support-contract";
import { backlogCron } from "./crons/backlog";
import { inboxRoute } from "./routes/inbox";
import { initHook } from "./hooks/init";
import { tickHook } from "./hooks/tick";
import { messageHook } from "./hooks/message";

export default defineAgent({
  name: "${agentName}",
  label: "${opts.label ?? agentName}",
  description: "Support agent with full primitive coverage.",
  tags: ["support", "ai"],
  systemPrompt: "You are a fast, empathetic support operations assistant.",
  state: agentState,
  routes: [inboxRoute],
  contracts: [supportContract],
  cron: [backlogCron],
  hooks: [initHook, tickHook, messageHook],
});
`;

  await writeTemplateFile(agentDir, "index.ts", index);
  await writeTemplateFile(agentDir, "state.ts", stateFile);
  await writeTemplateFile(join(agentDir, "tools"), "draft-reply.ts", toolFile);
  await writeTemplateFile(
    join(agentDir, "listeners"),
    "classify-ticket.ts",
    listenerFile,
  );
  await writeTemplateFile(
    join(agentDir, "contracts"),
    "support-contract.ts",
    contractFile,
  );
  await writeTemplateFile(join(agentDir, "crons"), "backlog.ts", cronFile);
  await writeTemplateFile(join(agentDir, "routes"), "inbox.ts", routeFile);
  await writeTemplateFile(join(agentDir, "hooks"), "init.ts", initHook);
  await writeTemplateFile(join(agentDir, "hooks"), "tick.ts", tickHook);
  await writeTemplateFile(join(agentDir, "hooks"), "message.ts", messageHook);
}

export const supportTemplate: TemplateDefinition = {
  id: "support",
  name: "Support",
  description: "Support template with all primitives and AI",
  icon: "🎧",
  generate: generateSupport,
};
