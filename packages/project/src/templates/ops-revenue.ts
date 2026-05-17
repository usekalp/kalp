import { join } from "node:path";
import type { TemplateDefinition } from "./types";
import { writeTemplateFile } from "./utils";

async function generateOpsRevenue(opts: {
  agentName: string;
  cwd: string;
  label?: string;
}): Promise<void> {
  const { agentName, cwd } = opts;
  const agentDir = join(cwd, "agents", agentName);

  const stateFile = `import { z } from "zod";

export const agentState = z.object({
  processedCount: z.number().default(0),
  lastScore: z.number().default(0),
  lastDecision: z.enum(["approved", "review"]).default("review"),
});

export type AgentState = z.infer<typeof agentState>;
`;

  const toolFile = `import { defineToolFor } from "@kalphq/sdk";
import { z } from "zod";
import type { AgentState } from "../state";

export const scoreOpportunity = defineToolFor<AgentState>()({
  id: "score_opportunity",
  inputSchema: z.object({ transcript: z.string() }),
  outputSchema: z.object({
    score: z.number(),
    summary: z.string(),
  }),
  async handler({ transcript }, ctx) {
    // Business intent: create a consistent, explainable lead score.
    const summary = await ctx.ai.generate({
      model: "gpt-4o-mini",
      system: "Summarize sales call.",
      prompt: transcript,
    });

    return {
      score: Math.min(99, Math.max(1, summary.length % 100)),
      summary,
    };
  },
});
`;

  const listenerFile = `import { defineListenerFor } from "@kalphq/sdk";
import { z } from "zod";
import type { AgentState } from "../state";

export const approvalRequested = defineListenerFor<AgentState>()({
  event: "approval_requested",
  inputSchema: z.object({ score: z.number() }),
  outputSchema: z.object({
    approved: z.boolean(),
    reason: z.string(),
  }),
  async handler(payload, ctx) {
    // Business intent: local policy gate for auto-approval vs manual review.
    ctx.state.lastScore = payload.score;
    const approved = payload.score > 80;
    return {
      approved,
      reason: approved ? "high score" : "manual review required",
    };
  },
});
`;

  const contractFile = `import { defineContractFor } from "@kalphq/sdk";
import { z } from "zod";
import type { AgentState } from "../state";

export const revenueContract = defineContractFor<AgentState>()({
  name: "${agentName}",
  inputSchema: z.object({ opportunityId: z.string() }),
  outputSchema: z.object({
    ok: z.boolean(),
    policy: z.string(),
  }),
  async handler(input, ctx) {
    // Business intent: public capability for downstream orchestrators.
    const policy = await ctx.ai.generate({
      model: "gpt-4o-mini",
      system: "Return concise revenue policy.",
      prompt: input.opportunityId,
    });
    return { ok: true, policy };
  },
});
`;

  const cronFile = `import { defineCron, everySixHours } from "@kalphq/sdk";
import type { AgentState } from "../state";

export const pipelineScanCron = defineCron<AgentState>({
  expression: everySixHours,
  timezone: "UTC",
  async handler(ctx) {
    // Business intent: periodic reconciliation of decision status.
    if (ctx.state.lastScore > 90) {
      ctx.state.lastDecision = "approved";
    }
  },
});
`;

  const routeFile = `import { defineRouteFor } from "@kalphq/sdk";
import { z } from "zod";
import type { AgentState } from "../state";

export const pipelineRoute = defineRouteFor<AgentState>()({
  id: "pipeline",
  method: "POST",
  path: "/pipeline/check",
  inputSchema: z.object({ opportunityId: z.string() }),
  outputSchema: z.object({
    ok: z.boolean(),
    opportunityId: z.string().optional(),
    lastDecision: z.enum(["approved", "review"]),
  }),
  async handler({ body, ctx }) {
    // Business intent: expose current decision status for external dashboards.
    return {
      ok: true,
      opportunityId: body?.opportunityId,
      lastDecision: ctx.state.lastDecision,
    };
  },
});
`;

  const initHook = `import { defineHook } from "@kalphq/sdk";
import type { AgentState } from "../state";

export const initHook = defineHook<AgentState>({
  type: "init",
  async handler(ctx) {
    // Business intent: deterministic default policy at startup.
    ctx.state.lastDecision = "review";
  },
});
`;

  const tickHook = `import { defineHook } from "@kalphq/sdk";
import type { AgentState } from "../state";

export const tickHook = defineHook<AgentState>({
  type: "tick",
  async handler(ctx) {
    // Business intent: guardrails when workload is still zero.
    if (ctx.state.processedCount === 0) {
      ctx.state.lastDecision = "review";
    }
  },
});
`;

  const messageHook = `import { defineHook } from "@kalphq/sdk";
import type { AgentState } from "../state";
import { approvalRequested } from "../listeners/approval-requested";
import { scoreOpportunity } from "../tools/score-opportunity";

export const messageHook = defineHook<AgentState>({
  type: "message",
  async handler(message, ctx) {
    // Business intent: full rev-ops flow (score -> approve/review -> response).
    const scored = await ctx.actions.run(scoreOpportunity, {
      transcript: message.text,
    });
    const approval = await ctx.actions.emit(approvalRequested, {
      score: scored.score,
    });

    ctx.state.processedCount += 1;
    ctx.state.lastDecision = approval.approved ? "approved" : "review";

    return {
      text: approval.approved
        ? \`Approved (\${scored.score})\`
        : \`Review (\${scored.score})\`,
    };
  },
});
`;

  const indexFile = `import { defineAgent } from "@kalphq/sdk";
import { revenueContract } from "./contracts/revenue-contract";
import { pipelineScanCron } from "./crons/pipeline-scan";
import { initHook } from "./hooks/init";
import { messageHook } from "./hooks/message";
import { tickHook } from "./hooks/tick";
import { pipelineRoute } from "./routes/pipeline";
import { agentState } from "./state";

export default defineAgent({
  name: "${agentName}",
  label: "${opts.label ?? agentName}",
  description: "Revenue operations agent with full vNext primitives.",
  tags: ["revenue", "ops", "ai"],
  systemPrompt: "You optimize revenue pipeline decisions with clear rationale.",
  state: agentState,
  routes: [pipelineRoute],
  contracts: [revenueContract],
  cron: [pipelineScanCron],
  hooks: [initHook, tickHook, messageHook],
});
`;

  await writeTemplateFile(agentDir, "index.ts", indexFile);
  await writeTemplateFile(agentDir, "state.ts", stateFile);
  await writeTemplateFile(
    join(agentDir, "tools"),
    "score-opportunity.ts",
    toolFile,
  );
  await writeTemplateFile(
    join(agentDir, "listeners"),
    "approval-requested.ts",
    listenerFile,
  );
  await writeTemplateFile(
    join(agentDir, "contracts"),
    "revenue-contract.ts",
    contractFile,
  );
  await writeTemplateFile(join(agentDir, "crons"), "pipeline-scan.ts", cronFile);
  await writeTemplateFile(join(agentDir, "routes"), "pipeline.ts", routeFile);
  await writeTemplateFile(join(agentDir, "hooks"), "init.ts", initHook);
  await writeTemplateFile(join(agentDir, "hooks"), "tick.ts", tickHook);
  await writeTemplateFile(join(agentDir, "hooks"), "message.ts", messageHook);
}

export const opsRevenueTemplate: TemplateDefinition = {
  id: "ops-revenue",
  name: "Ops Revenue",
  description:
    "Revenue ops agent with contracts, hooks, routes, cron, listeners and tools",
  icon: "💼",
  generate: generateOpsRevenue,
};
