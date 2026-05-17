import { join } from "node:path";
import type { TemplateDefinition } from "./types";
import { writeTemplateFile } from "./utils";

async function generateBlank(opts: {
  agentName: string;
  cwd: string;
  label?: string;
}): Promise<void> {
  const { agentName, cwd } = opts;
  const agentDir = join(cwd, "agents", agentName);

  const stateFile = `import { z } from "zod";

export const agentState = z.object({
  status: z.enum(["idle", "processing"]).default("idle"),
  processedCount: z.number().default(0),
  lastSummary: z.string().optional(),
});

export type AgentState = z.infer<typeof agentState>;
`;

  const toolFile = `import { defineToolFor } from "@kalphq/sdk";
import { z } from "zod";
import type { AgentState } from "../state";

export const summarizeTool = defineToolFor<AgentState>()({
  id: "summarize_tool",
  inputSchema: z.object({ text: z.string() }),
  outputSchema: z.object({ summary: z.string() }),
  async handler({ text }, ctx) {
    // Business intent: transform raw user text into a concise actionable summary.
    const summary = await ctx.ai.generate({
      model: "gpt-4o-mini",
      system: "Summarize this in one sentence.",
      prompt: text,
    });
    return { summary };
  },
});
`;

  const listenerFile = `import { defineListenerFor } from "@kalphq/sdk";
import { z } from "zod";
import type { AgentState } from "../state";

export const summaryReviewed = defineListenerFor<AgentState>()({
  event: "summary_reviewed",
  inputSchema: z.object({ summary: z.string() }),
  outputSchema: z.object({ accepted: z.boolean() }),
  async handler(payload, ctx) {
    // Business intent: quality gate to decide if a summary can be sent to the client.
    ctx.state.status = "processing";
    return { accepted: payload.summary.length > 8 };
  },
});
`;

  const contractFile = `import { defineContractFor } from "@kalphq/sdk";
import { z } from "zod";
import type { AgentState } from "../state";

export const exampleContract = defineContractFor<AgentState>()({
  name: "${agentName}",
  inputSchema: z.object({ action: z.string() }),
  outputSchema: z.object({ ok: z.boolean(), recommendation: z.string() }),
  async handler(input, ctx) {
    // Business intent: expose a public API for external automation requests.
    const recommendation = await ctx.ai.generate({
      model: "gpt-4o-mini",
      system: "Generate a short operational recommendation.",
      prompt: input.action,
    });
    return { ok: true, recommendation };
  },
});
`;

  const cronFile = `import { defineCron, everySixHours } from "@kalphq/sdk";
import type { AgentState } from "../state";

export const healthCron = defineCron<AgentState>({
  expression: everySixHours,
  timezone: "UTC",
  async handler(ctx) {
    // Business intent: periodic housekeeping to keep state aligned.
    ctx.state.status = "idle";
  },
});
`;

  const routeFile = `import { defineRouteFor } from "@kalphq/sdk";
import { z } from "zod";
import type { AgentState } from "../state";

export const healthRoute = defineRouteFor<AgentState>()({
  id: "health",
  method: "POST",
  path: "/health",
  inputSchema: z.object({ ping: z.string() }),
  outputSchema: z.object({
    ok: z.boolean(),
    ping: z.string(),
    processed: z.number(),
  }),
  async handler({ body, ctx }) {
    // Business intent: simple operational endpoint for integration probes.
    return {
      ok: true,
      ping: body?.ping ?? "pong",
      processed: ctx.state.processedCount,
    };
  },
});
`;

  const initHook = `import { defineHook } from "@kalphq/sdk";
import type { AgentState } from "../state";

export const initHook = defineHook<AgentState>({
  type: "init",
  async handler(ctx) {
    // Business intent: ensure deterministic startup defaults.
    ctx.state.status = "idle";
  },
});
`;

  const tickHook = `import { defineHook } from "@kalphq/sdk";
import type { AgentState } from "../state";

export const tickHook = defineHook<AgentState>({
  type: "tick",
  async handler(ctx) {
    // Business intent: keep processing status coherent during periodic ticks.
    if (ctx.state.processedCount > 0) {
      ctx.state.status = "processing";
    }
  },
});
`;

  const messageHook = `import { defineHook } from "@kalphq/sdk";
import type { AgentState } from "../state";
import { summaryReviewed } from "../listeners/summary-reviewed";
import { summarizeTool } from "../tools/summarize-tool";

export const messageHook = defineHook<AgentState>({
  type: "message",
  async handler(message, ctx) {
    // Business intent: end-to-end message flow (summarize -> review -> answer).
    const result = await ctx.actions.run(summarizeTool, { text: message.text });
    const review = await ctx.actions.emit(summaryReviewed, {
      summary: result.summary,
    });

    ctx.state.processedCount += 1;
    ctx.state.lastSummary = result.summary;

    return {
      text: review.accepted
        ? result.summary
        : \`Needs review: \${result.summary}\`,
    };
  },
});
`;

  const agentIndex = `import { defineAgent } from "@kalphq/sdk";
import { exampleContract } from "./contracts/example-contract";
import { healthCron } from "./crons/health";
import { initHook } from "./hooks/init";
import { messageHook } from "./hooks/message";
import { tickHook } from "./hooks/tick";
import { healthRoute } from "./routes/health";
import { agentState } from "./state";

export default defineAgent({
  name: "${agentName}",
  label: "${opts.label ?? agentName}",
  description: "Complete vNext starter agent.",
  tags: ["starter", "ai", "vnext"],
  systemPrompt: "You are a concise operations copilot.",
  state: agentState,
  routes: [healthRoute],
  contracts: [exampleContract],
  cron: [healthCron],
  hooks: [initHook, tickHook, messageHook],
});
`;

  await writeTemplateFile(agentDir, "index.ts", agentIndex);
  await writeTemplateFile(agentDir, "state.ts", stateFile);
  await writeTemplateFile(join(agentDir, "tools"), "summarize-tool.ts", toolFile);
  await writeTemplateFile(
    join(agentDir, "listeners"),
    "summary-reviewed.ts",
    listenerFile,
  );
  await writeTemplateFile(
    join(agentDir, "contracts"),
    "example-contract.ts",
    contractFile,
  );
  await writeTemplateFile(join(agentDir, "crons"), "health.ts", cronFile);
  await writeTemplateFile(join(agentDir, "routes"), "health.ts", routeFile);
  await writeTemplateFile(join(agentDir, "hooks"), "init.ts", initHook);
  await writeTemplateFile(join(agentDir, "hooks"), "tick.ts", tickHook);
  await writeTemplateFile(join(agentDir, "hooks"), "message.ts", messageHook);
}

export const blankTemplate: TemplateDefinition = {
  id: "blank",
  name: "Blank",
  description: "Complete vNext starter with all primitives",
  icon: "⬜",
  generate: generateBlank,
};
