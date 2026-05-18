/**
 * Agent scaffolding with template support.
 *
 * @module
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getTemplate } from "./index";
import { deriveLabelFromName } from "../labels";
import type { TemplateId } from "./types";

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
    if (!templateDef) throw new Error(`Unknown template: ${template}`);
    await templateDef.generate({ agentName, cwd, label: agentLabel });
    return;
  }

  const agentDir = join(cwd, "agents", agentName);
  for (const dir of [
    "tools",
    "listeners",
    "contracts",
    "routes",
    "crons",
    "hooks",
  ]) {
    await mkdir(join(agentDir, dir), { recursive: true });
  }

  await writeFile(
    join(agentDir, "state.ts"),
    `import { z } from "zod";

export const agentState = z.object({
  processedCount: z.number().default(0),
  lastSummary: z.string().optional(),
});

export type AgentState = z.infer<typeof agentState>;
`,
    "utf-8",
  );

  await writeFile(
    join(agentDir, "tools", "example-tool.ts"),
    `import { defineToolFor } from "@kalphq/sdk";
import { z } from "zod";
import type { AgentState } from "../state";

export const exampleTool = defineToolFor<AgentState>()({
  id: "example_tool",
  inputSchema: z.object({ text: z.string() }),
  outputSchema: z.object({ summary: z.string() }),
  async handler({ text }, ctx) {
    // Business intent: convert raw user input into concise actionable text.
    const summary = await ctx.ai.generate({
      model: "gpt-4o-mini",
      system: "Summarize in one sentence.",
      prompt: text,
    });
    return { summary };
  },
});
`,
    "utf-8",
  );

  await writeFile(
    join(agentDir, "listeners", "review-summary.ts"),
    `import { defineListenerFor } from "@kalphq/sdk";
import { z } from "zod";
import type { AgentState } from "../state";

export const reviewSummary = defineListenerFor<AgentState>()({
  event: "review_summary",
  inputSchema: z.object({ summary: z.string() }),
  outputSchema: z.object({ accepted: z.boolean() }),
  async handler(payload, ctx) {
    // Business intent: local validation gate before returning a summary.
    ctx.state.lastSummary = payload.summary;
    return { accepted: payload.summary.length > 10 };
  },
});
`,
    "utf-8",
  );

  await writeFile(
    join(agentDir, "contracts", "agent-contract.ts"),
    `import { defineContractFor } from "@kalphq/sdk";
import { z } from "zod";
import type { AgentState } from "../state";

export const agentContract = defineContractFor<AgentState>()({
  name: "${agentName}",
  inputSchema: z.object({ action: z.string() }),
  outputSchema: z.object({
    ok: z.boolean(),
    plan: z.string(),
  }),
  async handler(input, ctx) {
    // Business intent: external API for lightweight plan generation.
    const plan = await ctx.ai.generate({
      model: "gpt-4o-mini",
      system: "Generate short plan.",
      prompt: input.action,
    });
    return { ok: true, plan };
  },
});
`,
    "utf-8",
  );

  await writeFile(
    join(agentDir, "routes", "ping.ts"),
    `import { defineRouteFor } from "@kalphq/sdk";
import { z } from "zod";
import type { AgentState } from "../state";

export const pingRoute = defineRouteFor<AgentState>()({
  id: "ping",
  method: "POST",
  path: "/ping",
  inputSchema: z.object({ message: z.string() }),
  outputSchema: z.object({
    ok: z.boolean(),
    echo: z.string().optional(),
    count: z.number(),
  }),
  async handler({ body, ctx }) {
    // Business intent: endpoint for health checks and quick echo tests.
    return {
      ok: true,
      echo: body?.message,
      count: ctx.state.processedCount,
    };
  },
});
`,
    "utf-8",
  );

  await writeFile(
    join(agentDir, "crons", "heartbeat.ts"),
    `import { defineCron, everySixHours } from "@kalphq/sdk";
import type { AgentState } from "../state";

export const heartbeatCron = defineCron<AgentState>({
  expression: everySixHours,
  timezone: "UTC",
  async handler(ctx) {
    // Business intent: periodic housekeeping for empty-state sessions.
    if (!ctx.state.lastSummary) {
      ctx.state.lastSummary = "heartbeat";
    }
  },
});
`,
    "utf-8",
  );

  await writeFile(
    join(agentDir, "hooks", "init.ts"),
    `import { defineHook } from "@kalphq/sdk";
import type { AgentState } from "../state";

export const initHook = defineHook<AgentState>({
  type: "init",
  async handler(ctx) {
    // Business intent: deterministic startup state.
    ctx.state.processedCount = 0;
  },
});
`,
    "utf-8",
  );

  await writeFile(
    join(agentDir, "hooks", "tick.ts"),
    `import { defineHook } from "@kalphq/sdk";
import type { AgentState } from "../state";

export const tickHook = defineHook<AgentState>({
  type: "tick",
  async handler(ctx) {
    // Business intent: keep transient state coherent during idle ticks.
    if (ctx.state.processedCount > 0 && !ctx.state.lastSummary) {
      ctx.state.lastSummary = "pending";
    }
  },
});
`,
    "utf-8",
  );

  await writeFile(
    join(agentDir, "hooks", "message.ts"),
    `import { defineHook } from "@kalphq/sdk";
import type { AgentState } from "../state";
import { reviewSummary } from "../listeners/review-summary";
import { exampleTool } from "../tools/example-tool";

export const messageHook = defineHook<AgentState>({
  type: "message",
  async handler(message, ctx) {
    // Business intent: run summarize + review flow and persist metrics.
    const result = await ctx.actions.run(exampleTool, { text: message.content });
    const review = await ctx.actions.call(reviewSummary, {
      summary: result.summary,
    });
    ctx.state.processedCount += 1;
    return {
      message: { role: "assistant" as const, content: review.accepted ? result.summary : \`Needs review: \${result.summary}\` },
      done: true,
    };
  },
});
`,
    "utf-8",
  );

  await writeFile(
    join(agentDir, "index.ts"),
    `import { defineAgent } from "@kalphq/sdk";
import { agentContract } from "./contracts/agent-contract";
import { heartbeatCron } from "./crons/heartbeat";
import { initHook } from "./hooks/init";
import { messageHook } from "./hooks/message";
import { tickHook } from "./hooks/tick";
import { pingRoute } from "./routes/ping";
import { agentState } from "./state";

export default defineAgent({
  name: "${agentName}",
  label: "${agentLabel}",
  description: "Generated complete vNext agent.",
  tags: ["starter", "generated", "ai"],
  systemPrompt: "You are a concise assistant focused on reliable execution.",
  state: agentState,
  routes: [pingRoute],
  contracts: [agentContract],
  cron: [heartbeatCron],
  hooks: [initHook, tickHook, messageHook],
});
`,
    "utf-8",
  );
}
