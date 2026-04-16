import { asAgentId, defineAgent } from "@kalphq/sdk";
import { exampleStep } from "./steps/example-step.js";
import { transformData } from "./steps/transform-data.js";
import { exampleTool } from "./tools/example-tool.js";
import { httpRequest } from "./tools/http-request.js";
import { genericInbound } from "./webhooks/generic-inbound.js";
import { healthCheck } from "./webhooks/health-check.js";
import { taskComplete } from "./signals/task-complete.js";
import { errorAlert } from "./signals/error-alert.js";

export default defineAgent({
  id: asAgentId("__AGENT_NAME__"),
  name: "__AGENT_NAME__",
  steps: [exampleStep, transformData],
  tools: [exampleTool, httpRequest],
  webhooks: [genericInbound, healthCheck],
  signals: [taskComplete, errorAlert],

  async onMessage(message, ctx) {
    const stepped = await ctx.runStep(exampleStep, { message: message.text });
    const tooled = await ctx.callTool(exampleTool, { query: message.text });
    return { text: `${stepped.result} | ${tooled.output}` };
  },
});
