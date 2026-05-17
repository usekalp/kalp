import { join } from "node:path";
import type { TemplateDefinition } from "./types";
import { writeTemplateFile } from "./utils";

async function generateResearcher(opts: {
  agentName: string;
  cwd: string;
  label?: string;
}): Promise<void> {
  const { agentName, cwd } = opts;
  const agentDir = join(cwd, "agents", agentName);

  const state = `import { z } from "zod";

export const agentState = z.object({
  draftsCreated: z.number().default(0),
  lastTopic: z.string().optional(),
  lastDigest: z.string().optional(),
});

export type AgentState = z.infer<typeof agentState>;
`;

  const tool = `import { defineToolFor } from "@kalphq/sdk";
import { z } from "zod";
import type { AgentState } from "../state";

export const summarizeResearch = defineToolFor<AgentState>()({
  id: "summarize_research",
  inputSchema: z.object({ topic: z.string() }),
  outputSchema: z.object({
    summary: z.string(),
    nextQuestion: z.string(),
  }),
  async handler({ topic }, ctx) {
    // Business intent: synthesize research topic and suggest next exploration step.
    const summary = await ctx.ai.generate({
      model: "gpt-4o-mini",
      system: "Summarize research topic.",
      prompt: topic,
    });

    const nextQuestion = await ctx.ai.generate({
      model: "gpt-4o-mini",
      system: "Propose one next research question.",
      prompt: summary,
    });

    return { summary, nextQuestion };
  },
});
`;

  const listener = `import { defineListenerFor } from "@kalphq/sdk";
import { z } from "zod";
import type { AgentState } from "../state";

export const digestReviewed = defineListenerFor<AgentState>()({
  event: "digest_reviewed",
  inputSchema: z.object({ summary: z.string() }),
  outputSchema: z.object({ publish: z.boolean() }),
  async handler(payload, ctx) {
    // Business intent: local publish gate for generated digest quality.
    ctx.state.lastDigest = payload.summary;
    return { publish: payload.summary.length > 20 };
  },
});
`;

  const contract = `import { defineContractFor } from "@kalphq/sdk";
import { z } from "zod";
import type { AgentState } from "../state";

export const researchContract = defineContractFor<AgentState>()({
  name: "${agentName}",
  inputSchema: z.object({ topic: z.string() }),
  outputSchema: z.object({
    accepted: z.boolean(),
    brief: z.string(),
  }),
  async handler(input, ctx) {
    // Business intent: expose research brief generation to external orchestrators.
    const brief = await ctx.ai.generate({
      model: "gpt-4o-mini",
      system: "Create short research brief.",
      prompt: input.topic,
    });

    return { accepted: true, brief };
  },
});
`;

  const cron = `import { defineCron, everySixHours } from "@kalphq/sdk";
import type { AgentState } from "../state";
import { summarizeResearch } from "../tools/summarize-research";

export const refreshCron = defineCron<AgentState>({
  expression: everySixHours,
  timezone: "UTC",
  async handler(ctx) {
    // Business intent: keep periodic digest fresh even without direct messages.
    const topic = ctx.state.lastTopic ?? "market trends";
    const digest = await ctx.actions.run(summarizeResearch, { topic });
    ctx.state.lastDigest = digest.summary;
  },
});
`;

  const route = `import { defineRouteFor } from "@kalphq/sdk";
import { z } from "zod";
import type { AgentState } from "../state";

export const digestRoute = defineRouteFor<AgentState>()({
  id: "digest",
  method: "POST",
  path: "/digest",
  inputSchema: z.object({ topic: z.string() }),
  outputSchema: z.object({
    ok: z.boolean(),
    topic: z.string().optional(),
    lastDigest: z.string().nullable(),
  }),
  async handler({ body, ctx }) {
    // Business intent: HTTP access for latest digest status.
    return {
      ok: true,
      topic: body?.topic,
      lastDigest: ctx.state.lastDigest ?? null,
    };
  },
});
`;

  const init = `import { defineHook } from "@kalphq/sdk";
import type { AgentState } from "../state";

export const initHook = defineHook<AgentState>({
  type: "init",
  async handler(ctx) {
    // Business intent: startup marker for first digest cycle.
    ctx.state.lastDigest = "ready";
  },
});
`;

  const tick = `import { defineHook } from "@kalphq/sdk";
import type { AgentState } from "../state";

export const tickHook = defineHook<AgentState>({
  type: "tick",
  async handler(ctx) {
    // Business intent: default topic bootstrap when no drafts exist.
    if (ctx.state.draftsCreated === 0) {
      ctx.state.lastTopic = "strategy";
    }
  },
});
`;

  const message = `import { defineHook } from "@kalphq/sdk";
import type { AgentState } from "../state";
import { summarizeResearch } from "../tools/summarize-research";
import { digestReviewed } from "../listeners/digest-reviewed";

export const messageHook = defineHook<AgentState>({
  type: "message",
  async handler(message, ctx) {
    // Business intent: execute full research response flow for incoming requests.
    const result = await ctx.actions.run(summarizeResearch, { topic: message.text });
    const review = await ctx.actions.emit(digestReviewed, {
      summary: result.summary,
    });

    ctx.state.draftsCreated += 1;
    ctx.state.lastTopic = message.text;

    return {
      text: review.publish
        ? \`\${result.summary}\\nNext: \${result.nextQuestion}\`
        : \`Draft: \${result.summary}\`,
    };
  },
});
`;

  const index = `import { defineAgent } from "@kalphq/sdk";
import { agentState } from "./state";
import { researchContract } from "./contracts/research-contract";
import { refreshCron } from "./crons/refresh";
import { digestRoute } from "./routes/digest";
import { initHook } from "./hooks/init";
import { tickHook } from "./hooks/tick";
import { messageHook } from "./hooks/message";

export default defineAgent({
  name: "${agentName}",
  label: "${opts.label ?? agentName}",
  description: "Research template with all primitives and AI.",
  tags: ["research", "ai"],
  systemPrompt: "You are a rigorous research analyst that writes concise findings.",
  state: agentState,
  routes: [digestRoute],
  contracts: [researchContract],
  cron: [refreshCron],
  hooks: [initHook, tickHook, messageHook],
});
`;

  await writeTemplateFile(agentDir, "index.ts", index);
  await writeTemplateFile(agentDir, "state.ts", state);
  await writeTemplateFile(join(agentDir, "tools"), "summarize-research.ts", tool);
  await writeTemplateFile(
    join(agentDir, "listeners"),
    "digest-reviewed.ts",
    listener,
  );
  await writeTemplateFile(
    join(agentDir, "contracts"),
    "research-contract.ts",
    contract,
  );
  await writeTemplateFile(join(agentDir, "crons"), "refresh.ts", cron);
  await writeTemplateFile(join(agentDir, "routes"), "digest.ts", route);
  await writeTemplateFile(join(agentDir, "hooks"), "init.ts", init);
  await writeTemplateFile(join(agentDir, "hooks"), "tick.ts", tick);
  await writeTemplateFile(join(agentDir, "hooks"), "message.ts", message);
}

export const researcherTemplate: TemplateDefinition = {
  id: "researcher",
  name: "Researcher",
  description: "Research template with all primitives and AI",
  icon: "🔎",
  generate: generateResearcher,
};
