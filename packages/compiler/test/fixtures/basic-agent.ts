import { z } from "zod";
import {
  defineAgent,
  defineTool,
  defineRoute,
  defineHook,
  defineContract,
  defineListener,
  defineCron,
  everySixHours,
} from "@kalphq/sdk";
import { mockUtil } from "./utils";

export const agentState = z.object({
  status: z.enum(["idle", "processing"]).default("idle"),
  processedCount: z.number().default(0),
});

export const testContract = defineContract<z.infer<typeof agentState>>({
  name: "sales-agent",
  inputSchema: z.object({ query: z.string() }),
  outputSchema: z.object({ result: z.string() }),
  async handler(input) {
    return { result: input.query.toUpperCase() };
  },
});

export const summarizeTool = defineTool<z.infer<typeof agentState>>({
  id: "summarize_tool",
  inputSchema: z.object({ text: z.string() }),
  async handler(input) {
    return { summary: mockUtil(input.text) };
  },
});

export const approvalRequested = defineListener<z.infer<typeof agentState>>({
  event: "approval_requested",
  inputSchema: z.object({ score: z.number() }),
  outputSchema: z.object({ approved: z.boolean() }),
  async handler(payload, ctx) {
    ctx.state.processedCount += 1;
    return { approved: payload.score >= 80 };
  },
});

export const healthRoute = defineRoute<z.infer<typeof agentState>, any>({
  id: "GET:/health",
  method: "GET",
  path: "/health",
  async handler() {
    return { status: "ok" };
  },
});

export const initHook = defineHook<z.infer<typeof agentState>>({
  type: "init",
  async handler(ctx) {
    ctx.state.status = "processing";
  },
});

export const messageHook = defineHook<z.infer<typeof agentState>>({
  type: "message",
  async handler(message, ctx) {
    const result = (await ctx.actions.run(summarizeTool as any, {
      text: message.text,
    })) as { summary: string };
    const approval = (await ctx.actions.emit(approvalRequested as any, {
      score: 91,
    })) as { approved: boolean };
    return { text: approval.approved ? result.summary : "blocked" };
  },
});

export const scanCron = defineCron<z.infer<typeof agentState>>({
  expression: everySixHours,
  timezone: "UTC",
  async handler(ctx) {
    ctx.state.processedCount += 1;
  },
});

export default defineAgent({
  name: "test-agent",
  description: "A test agent",
  state: agentState,
  routes: [healthRoute],
  contracts: [testContract],
  cron: [scanCron],
  hooks: [initHook, messageHook],
});
