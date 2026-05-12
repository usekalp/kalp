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

  const agentIndex = [
    'import { defineAgent, defineListener } from "@kalphq/sdk";',
    'import { scoreOpportunity } from "./steps/score-opportunity";',
    'import { draftProposal } from "./steps/draft-proposal";',
    'import { riskGate } from "./steps/risk-gate";',
    'import { intakeRoute } from "./routes/intake";',
    'import { adminRoute } from "./routes/admin";',
    'import { revenueContract, approvalContract } from "./contract/revenue-contract";',
    "",
    "const approvalListener = defineListener({",
    "  source: approvalContract,",
    '  event: "approval_decided",',
    "  async handler(payload, ctx) {",
    '    await ctx.storage.put(`approval:${payload.opportunityId}`, payload);',
    "  },",
    "});",
    "",
    "export default defineAgent({",
    `  name: "${agentName}",`,
    `  label: "${opts.label ?? agentName}",`,
    '  description: "Revenue operations agent for pipeline qualification and handoff",',
    "  public: false,",
    "  contract: revenueContract,",
    "  listeners: [approvalListener],",
    "  emits: {",
    '    opportunity_scored: "Opportunity score payload",',
    '    approval_requested: "Approval request payload",',
    '    handoff_completed: "Handoff payload",',
    "  },",
    "  routes: [intakeRoute, adminRoute],",
    "",
    "  async onMessage(message, ctx) {",
    "    const scored = await ctx.actions.run(scoreOpportunity, {",
    "      transcript: message.text,",
    "    });",
    "    await ctx.actions.emit('opportunity_scored', scored);",
    "    const gated = await ctx.actions.run(riskGate, scored);",
    "    if (!gated.approved) {",
    "      await ctx.actions.emit('approval_requested', gated);",
    "      const wake = await ctx.actions.waitForEvent(`approval_${gated.opportunityId}`, '48h');",
    "      if (wake.type !== 'event') return { text: 'Waiting for approval decision.' };",
    "    }",
    "    const proposal = await ctx.actions.run(draftProposal, gated);",
    "    await ctx.actions.waitUntil(ctx.date.add('2h'));",
    "    await ctx.actions.emit('handoff_completed', proposal);",
    "    return { text: proposal.summary };",
    "  },",
    "",
    "  async onCall(input, ctx) {",
    "    return { ok: true, action: input.action, receivedAt: ctx.date.toISOString() };",
    "  },",
    "});",
  ].join("\n");

  const scoreStep = [
    'import { defineStep, z } from "@kalphq/sdk";',
    "export const scoreOpportunity = defineStep({",
    '  id: "score_opportunity",',
    "  inputSchema: z.object({ transcript: z.string() }),",
    "  outputSchema: z.object({ opportunityId: z.string(), score: z.number(), risk: z.enum(['low','medium','high']) }),",
    "  async handler({ transcript }) {",
    "    return { opportunityId: `opp_${Date.now()}`, score: Math.min(99, transcript.length % 100), risk: transcript.length % 2 ? 'low' : 'medium' };",
    "  },",
    "});",
  ].join("\n");

  const riskStep = [
    'import { defineStep, z } from "@kalphq/sdk";',
    "export const riskGate = defineStep({",
    '  id: "risk_gate",',
    "  inputSchema: z.object({ opportunityId: z.string(), score: z.number(), risk: z.enum(['low','medium','high']) }),",
    "  outputSchema: z.object({ opportunityId: z.string(), score: z.number(), risk: z.enum(['low','medium','high']), approved: z.boolean() }),",
    "  async handler(input) {",
    "    return { ...input, approved: input.score >= 55 && input.risk !== 'high' };",
    "  },",
    "});",
  ].join("\n");

  const draftStep = [
    'import { defineStep, z } from "@kalphq/sdk";',
    "export const draftProposal = defineStep({",
    '  id: "draft_proposal",',
    "  inputSchema: z.object({ opportunityId: z.string(), score: z.number(), risk: z.enum(['low','medium','high']), approved: z.boolean() }),",
    "  outputSchema: z.object({ opportunityId: z.string(), summary: z.string() }),",
    "  async handler(input, ctx) {",
    "    const summary = await ctx.ai.generate({",
    "      model: 'gpt-4o-mini',",
    "      prompt: `Create a concise proposal for ${input.opportunityId} with score ${input.score}`",
    "    });",
    "    return { opportunityId: input.opportunityId, summary };",
    "  },",
    "});",
  ].join("\n");

  const intakeRoute = [
    'import { defineRoute } from "@kalphq/sdk";',
    "export const intakeRoute = defineRoute({",
    '  id: "ops_intake",',
    '  method: "POST",',
    '  path: "/webhooks/intake",',
    "  public: true,",
    "  async handler(req, res) {",
    "    const body = await req.json();",
    "    res.json({ ok: true, received: body });",
    "  },",
    "});",
  ].join("\n");

  const adminRoute = [
    'import { defineRoute } from "@kalphq/sdk";',
    "export const adminRoute = defineRoute({",
    '  id: "ops_admin",',
    '  method: "GET",',
    '  path: "/admin/status",',
    "  public: false,",
    "  async handler(req, res, ctx) {",
    "    if (!ctx.auth) return res.status(401).json({ error: 'Unauthorized' });",
    "    res.json({ ok: true, userId: ctx.auth.userId });",
    "  },",
    "});",
  ].join("\n");

  const contract = [
    'import { defineContract, z } from "@kalphq/sdk";',
    "export const revenueContract = defineContract('revenue-ops', {",
    "  input: z.object({ action: z.string(), payload: z.record(z.unknown()).optional() }),",
    "  output: z.object({ ok: z.boolean(), action: z.string(), receivedAt: z.string() }),",
    "  emits: {",
    "    opportunity_scored: z.object({ opportunityId: z.string(), score: z.number(), risk: z.enum(['low','medium','high']) }),",
    "    approval_requested: z.object({ opportunityId: z.string(), score: z.number(), risk: z.enum(['low','medium','high']), approved: z.boolean() }),",
    "    handoff_completed: z.object({ opportunityId: z.string(), summary: z.string() }),",
    "  },",
    "});",
    "",
    "export const approvalContract = defineContract('approval-service', {",
    "  input: z.object({ opportunityId: z.string() }),",
    "  output: z.object({ ok: z.boolean() }),",
    "  emits: {",
    "    approval_decided: z.object({ opportunityId: z.string(), approved: z.boolean() }),",
    "  },",
    "});",
  ].join("\n");

  await writeTemplateFile(agentDir, "index.ts", agentIndex);
  await writeTemplateFile(join(agentDir, "steps"), "score-opportunity.ts", scoreStep);
  await writeTemplateFile(join(agentDir, "steps"), "risk-gate.ts", riskStep);
  await writeTemplateFile(join(agentDir, "steps"), "draft-proposal.ts", draftStep);
  await writeTemplateFile(join(agentDir, "routes"), "intake.ts", intakeRoute);
  await writeTemplateFile(join(agentDir, "routes"), "admin.ts", adminRoute);
  await writeTemplateFile(join(agentDir, "contract"), "revenue-contract.ts", contract);
}

export const opsRevenueTemplate: TemplateDefinition = {
  id: "ops-revenue",
  name: "Revenue Ops",
  description: "Pipeline qualification + human handoff with event-driven orchestration",
  icon: "📈",
  generate: generateOpsRevenue,
};

