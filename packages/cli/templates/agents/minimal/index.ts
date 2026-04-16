import { asAgentId, defineAgent } from "@kalphq/sdk";
import { exampleStep } from "./steps/example-step.js";
import { exampleTool } from "./tools/example-tool.js";

export default defineAgent({
  id: asAgentId("__AGENT_NAME__"),
  name: "__AGENT_NAME__",
  steps: [exampleStep],
  tools: [exampleTool],

  async onMessage(message, ctx) {
    const stepped = await ctx.runStep(exampleStep, { message: message.text });
    const tooled = await ctx.callTool(exampleTool, { query: message.text });
    return { text: `${stepped.result} | ${tooled.output}` };
  },
});
