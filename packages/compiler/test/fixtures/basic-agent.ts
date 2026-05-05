import { z } from "zod";
import { defineStep, defineTool, defineRoute, defineAgent, defineContract } from "@kalphq/sdk";

import { mockUtil } from "./utils";

export const testContract = defineContract("sales-agent", {
  input: z.object({ query: z.string() }),
  output: z.object({ result: z.string() })
});

export const step1 = defineStep({
  id: "step_1",
  inputSchema: z.object({ text: z.string() }),
  outputSchema: z.object({ text: z.string() }),
  async handler(input, ctx) {
    return { text: mockUtil(input.text) };
  }
});

export const format_response = defineStep({
  id: "format_response",
  inputSchema: z.object({ text: z.string(), sources: z.array(z.string()).optional() }),
  outputSchema: z.object({ formatted: z.string() }),
  async handler(input, ctx) {
    return { formatted: input.text };
  }
});

export const step_no_input = defineStep({
  id: "step_no_input",
  inputSchema: z.object({}).optional(),
  outputSchema: z.object({ ok: z.boolean() }),
  async handler(input, ctx) {
    return { ok: true };
  }
});

export const step_with_utils = defineStep({
  id: "step_with_utils",
  inputSchema: z.object({ text: z.string() }),
  outputSchema: z.object({ formatted: z.string() }),
  async handler(input, ctx) {
    return { formatted: mockUtil(input.text) };
  }
});

export const search_tool = defineTool({
  id: "search_tool",
  inputSchema: z.object({ q: z.string() }),
  async handler(input, ctx) {
    return ["result"];
  }
});

export const healthRoute = defineRoute({
  id: "GET:/health",
  method: "GET",
  path: "/health",
  async handler(req, res, ctx) {
    return { status: "ok" };
  }
});

export default defineAgent({
  id: "test-agent",
  name: "test-agent",
  description: "A test agent",
  contract: testContract,
  systemPrompt: () => "dynamic prompt",
  routes: [healthRoute],
  async onMessage(ctx) {
    return { text: "hello from hook" };
  },
  async onCall(input, ctx) {
    return { result: "call resolved" };
  }
});
