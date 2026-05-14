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
 
  // Derive contract name from agent name (e.g. "my-agent" -> "MyAgent")
  const contractName = agentName
    .replace(/-+(.)/g, (_, char: string) => char.toUpperCase())
    .replace(/^./, (char: string) => char.toUpperCase());
  const label = opts.label ?? agentName;

  const agentIndex = [
    'import { defineAgent, everySixHours } from "@kalphq/sdk";',
    'import { ' + contractName + 'Contract } from "./contract/' + agentName + '-contract";',
    'import { approvalListener } from "./listeners/approval-listener";',
    'import { onInit } from "./hooks/on-init";',
    'import { onTick } from "./hooks/on-tick";',
    'import { dailyPipelineScan } from "./crons/daily-pipeline-scan";',
    'import { intakeRoute } from "./routes/intake";',
    'import { adminRoute } from "./routes/admin";',
    'import { lookupAccountSignals } from "./tools/lookup-account-signals";',
    'import { scoreOpportunity } from "./steps/score-opportunity";',
    'import { riskGate } from "./steps/risk-gate";',
    'import { draftProposal } from "./steps/draft-proposal";',
    "",
    "export default defineAgent({",
    `  name: "${agentName}",`,
    `  label: "${label}",`,
    '  description: "Revenue operations agent for pipeline qualification and handoff",',
    '  systemPrompt: "You are a revenue operations specialist focused on qualification quality and safe handoff.",',
    '  tags: ["ops", "revenue", "pipeline", "handoff"],',
    "  skipAuth: false,",
    "  contract: " + contractName + "Contract,",
    "  listeners: [approvalListener],",
    "  routes: [intakeRoute, adminRoute],",
    "  cron: [",
    "    {",
    "      expression: everySixHours,",
    "      handler: dailyPipelineScan,",
    '      timezone: "UTC",',
    "    },",
    "  ],",
    "",
    "  onInit,",
    "  onTick,",
    "",
    "  async onMessage(message, ctx) {",
    "    const signals = await ctx.actions.run(lookupAccountSignals, {",
    "      transcript: message.text,",
    "    });",
    "",
    "    const scored = await ctx.actions.run(scoreOpportunity, {",
    "      transcript: message.text,",
    "      accountTier: signals.accountTier as 'enterprise' | 'mid-market' | 'smb',",
    "    });",
    "    await ctx.actions.emit('opportunity_scored', scored);",
    "",
    "    const gated = await ctx.actions.run(riskGate, scored);",
    "    if (!gated.approved) {",
    "      await ctx.actions.emit('approval_requested', gated);",
    "      const wake = await ctx.actions.waitForEvent(",
    "        `approval_${gated.opportunityId}`,",
    "        '48h',",
    "      );",
    "      if (wake.type !== 'event') {",
    "        return { text: 'Waiting for approval decision.' };",
    "      }",
    "    }",
    "",
    "    const proposal = await ctx.actions.run(draftProposal, gated);",
    "    await ctx.actions.waitUntil(ctx.date.add('2h'));",
    "    await ctx.actions.emit('handoff_completed', proposal);",
    "    return { text: proposal.summary };",
    "  },",
    "",
    "  async onCall(input, ctx) {",
    "    return {",
    "      ok: true,",
    "      action: input.action,",
    "      receivedAt: ctx.date.toISOString(),",
    "    };",
    "  },",
    "});",
  ].join("\n");

  const scoreStep = [
    'import { bindContract, z } from "@kalphq/sdk";',
    'import { ' + contractName + 'Contract } from "../contract/' + agentName + '-contract";',
    "",
    "const { defineStep } = bindContract(" + contractName + "Contract);",
    "",
    "export const scoreOpportunity = defineStep({",
    '  id: "score_opportunity",',
    "  inputSchema: z.object({",
    "    transcript: z.string(),",
    "    accountTier: z.enum(['enterprise', 'mid-market', 'smb']),",
    "  }),",
    "  outputSchema: z.object({",
    "    opportunityId: z.string(),",
    "    score: z.number(),",
    "    risk: z.enum(['low', 'medium', 'high']),",
    "    accountTier: z.enum(['enterprise', 'mid-market', 'smb']),",
    "  }),",
    "",
    "  async handler({ transcript, accountTier }) {",
    "    const baseScore = Math.min(99, transcript.length % 100);",
    "    const tierBoost = accountTier === 'enterprise' ? 8 : accountTier === 'mid-market' ? 4 : 0;",
    "    const score = Math.min(99, baseScore + tierBoost);",
    "    const risk: 'low' | 'medium' | 'high' = score > 75 ? 'low' : score > 45 ? 'medium' : 'high';",
    "    return {",
    "      opportunityId: `opp_${Date.now()}`,",
    "      score,",
    "      risk,",
    "      accountTier,",
    "    };",
    "  },",
    "});",
  ].join("\n");

  const riskStep = [
    'import { bindContract, z } from "@kalphq/sdk";',
    'import { ' + contractName + 'Contract } from "../contract/' + agentName + '-contract";',
    "",
    "const { defineStep } = bindContract(" + contractName + "Contract);",
    "",
    "export const riskGate = defineStep({",
    '  id: "risk_gate",',
    "  inputSchema: z.object({",
    "    opportunityId: z.string(),",
    "    score: z.number(),",
    "    risk: z.enum(['low', 'medium', 'high']),",
    "    accountTier: z.enum(['enterprise', 'mid-market', 'smb']),",
    "  }),",
    "  outputSchema: z.object({",
    "    opportunityId: z.string(),",
    "    score: z.number(),",
    "    risk: z.enum(['low', 'medium', 'high']),",
    "    accountTier: z.enum(['enterprise', 'mid-market', 'smb']),",
    "    approved: z.boolean(),",
    "  }),",
    "",
    "  async handler(input) {",
    "    const approved = input.score >= 55 && input.risk !== 'high';",
    "    return { ...input, approved };",
    "  },",
    "});",
  ].join("\n");

  const draftStep = [
    'import { bindContract, z } from "@kalphq/sdk";',
    'import { ' + contractName + 'Contract } from "../contract/' + agentName + '-contract";',
    "",
    "const { defineStep } = bindContract(" + contractName + "Contract);",
    "",
    "export const draftProposal = defineStep({",
    '  id: "draft_proposal",',
    "  inputSchema: z.object({",
    "    opportunityId: z.string(),",
    "    score: z.number(),",
    "    risk: z.enum(['low', 'medium', 'high']),",
    "    accountTier: z.enum(['enterprise', 'mid-market', 'smb']),",
    "    approved: z.boolean(),",
    "  }),",
    "  outputSchema: z.object({",
    "    opportunityId: z.string(),",
    "    summary: z.string(),",
    "  }),",
    "",
    "  async handler(input, ctx) {",
    "    const summary = await ctx.ai.generate({",
    "      model: 'gpt-4o-mini',",
    "      prompt:",
    "        `Create a concise revenue proposal for ${input.opportunityId} (tier: ${input.accountTier}, score: ${input.score}).`,",
    "    });",
    "    return {",
    "      opportunityId: input.opportunityId,",
    "      summary,",
    "    };",
    "  },",
    "});",
  ].join("\n");

  const lookupTool = [
    'import { bindContract, z } from "@kalphq/sdk";',
    'import { ' + contractName + 'Contract } from "../contract/' + agentName + '-contract";',
    "",
    "const { defineTool } = bindContract(" + contractName + "Contract);",
    "",
    "export const lookupAccountSignals = defineTool({",
    '  id: "lookup_account_signals",',
    "  inputSchema: z.object({ transcript: z.string() }),",
    "",
    "  async handler({ transcript }) {",
    "    const normalized = transcript.toLowerCase();",
    "    const accountTier = normalized.includes('enterprise')",
    "      ? 'enterprise'",
    "      : normalized.includes('mid')",
    "        ? 'mid-market'",
    "        : 'smb';",
    "    return {",
    "      accountTier,",
    "      confidence: normalized.length > 40 ? 0.84 : 0.62,",
    "    };",
    "  },",
    "});",
  ].join("\n");

  const intakeRoute = [
    'import { bindContract, z } from "@kalphq/sdk";',
    'import { ' + contractName + 'Contract } from "../contract/' + agentName + '-contract";',
    "",
    "const { defineRoute } = bindContract(" + contractName + "Contract);",
    "",
    "export const intakeRoute = defineRoute({",
    '  id: "ops_intake",',
    '  method: "POST",',
    '  path: "/webhooks/intake",',
    "  skipAuth: true,",
    "  inputSchema: z.any(),",
    "",
    "  async handler({ res, body }) {",
    "    res.json({ ok: true, received: body });",
    "  },",
    "});",
  ].join("\n");

  const adminRoute = [
    'import { bindContract } from "@kalphq/sdk";',
    'import { ' + contractName + 'Contract } from "../contract/' + agentName + '-contract";',
    "",
    "const { defineRoute } = bindContract(" + contractName + "Contract);",
    "",
    "export const adminRoute = defineRoute({",
    '  id: "ops_admin",',
    '  method: "GET",',
    '  path: "/admin/status",',
    "  skipAuth: true,",
    "",
    "  async handler({ res, ctx }) {",
    "    if (!ctx.auth) return res.status(401).json({ error: 'Unauthorized' });",
    "    res.json({ ok: true, userId: ctx.auth.userId });",
    "  },",
    "});",
  ].join("\n");

  const onInitHook = [
    'import { TypedKalpContext } from "@kalphq/sdk";',
    'import { ' + contractName + 'Contract } from "../contract/' + agentName + '-contract";',
    "",
    "export async function onInit(ctx: TypedKalpContext<typeof " + contractName + "Contract>): Promise<void> {",
    "  await ctx.storage.put('ops:initializedAt', ctx.date.toISOString());",
    "}",
  ].join("\n");

  const onTickHook = [
    'import { TypedKalpContext } from "@kalphq/sdk";',
    'import { ' + contractName + 'Contract } from "../contract/' + agentName + '-contract";',
    "",
    "export async function onTick(ctx: TypedKalpContext<typeof " + contractName + "Contract>): Promise<void> {",
    "  const ticks = (await ctx.storage.get('ops:tickCount')) ?? 0;",
    "  await ctx.storage.put('ops:tickCount', Number(ticks) + 1);",
    "}",
  ].join("\n");

  const cronJob = [
    "export async function dailyPipelineScan(): Promise<void> {",
    "  // Placeholder cron job for future pipeline health checks",
    "  return;",
    "}",
  ].join("\n");

  const listenerFile = [
    'import { bindContract } from "@kalphq/sdk";',
    'import { ' + contractName + 'Contract, approvalContract } from "../contract/' + agentName + '-contract";',
    "",
    "const { defineListener } = bindContract(" + contractName + "Contract);",
    "",
    "export const approvalListener = defineListener({",
    "  source: approvalContract,",
    '  event: "approval_decided",',
    "",
    "  async handler(payload, ctx) {",
    "    await ctx.storage.put(`approval:${payload.opportunityId}`, payload);",
    "  },",
    "});",
  ].join("\n");

  const contract = [
    'import { defineContract, z } from "@kalphq/sdk";',
    "",
    'export const ' + contractName + 'Contract = defineContract("' + agentName + '", {',
    "  input: z.object({",
    "    action: z.string(),",
    "    payload: z.record(z.unknown()).optional(),",
    "  }),",
    "  output: z.object({",
    "    ok: z.boolean(),",
    "    action: z.string(),",
    "    receivedAt: z.string(),",
    "  }),",
    "",
    "  emits: {",
    "    opportunity_scored: z.object({",
    "      opportunityId: z.string(),",
    "      score: z.number(),",
    "      risk: z.enum(['low', 'medium', 'high']),",
    "      accountTier: z.enum(['enterprise', 'mid-market', 'smb']),",
    "    }),",
    "    approval_requested: z.object({",
    "      opportunityId: z.string(),",
    "      score: z.number(),",
    "      risk: z.enum(['low', 'medium', 'high']),",
    "      approved: z.boolean(),",
    "      accountTier: z.enum(['enterprise', 'mid-market', 'smb']),",
    "    }),",
    "    handoff_completed: z.object({",
    "      opportunityId: z.string(),",
    "      summary: z.string(),",
    "    }),",
    "  },",
    "});",
    "",
    "export const approvalContract = defineContract('approval-service', {",
    "  input: z.object({ opportunityId: z.string() }),",
    "  output: z.object({ ok: z.boolean() }),",
    "",
    "  emits: {",
    "    approval_decided: z.object({",
    "      opportunityId: z.string(),",
    "      approved: z.boolean(),",
    "    }),",
    "  },",
    "});",
  ].join("\n");

  await writeTemplateFile(agentDir, "index.ts", agentIndex);
  await writeTemplateFile(
    join(agentDir, "steps"),
    "score-opportunity.ts",
    scoreStep,
  );
  await writeTemplateFile(join(agentDir, "steps"), "risk-gate.ts", riskStep);
  await writeTemplateFile(
    join(agentDir, "steps"),
    "draft-proposal.ts",
    draftStep,
  );
  await writeTemplateFile(
    join(agentDir, "tools"),
    "lookup-account-signals.ts",
    lookupTool,
  );
  await writeTemplateFile(join(agentDir, "routes"), "intake.ts", intakeRoute);
  await writeTemplateFile(join(agentDir, "routes"), "admin.ts", adminRoute);
  await writeTemplateFile(join(agentDir, "hooks"), "on-init.ts", onInitHook);
  await writeTemplateFile(join(agentDir, "hooks"), "on-tick.ts", onTickHook);
  await writeTemplateFile(
    join(agentDir, "crons"),
    "daily-pipeline-scan.ts",
    cronJob,
  );
  await writeTemplateFile(
    join(agentDir, "listeners"),
    "approval-listener.ts",
    listenerFile,
  );
  await writeTemplateFile(
    join(agentDir, "contract"),
    agentName + "-contract.ts",
    contract,
  );
}

export const opsRevenueTemplate: TemplateDefinition = {
  id: "ops-revenue",
  name: "Revenue Ops",
  description:
    "Pipeline qualification + human handoff with event-driven orchestration",
  icon: "📈",
  generate: generateOpsRevenue,
};
