// Superseded by static template at templates/agents/minimal/ (used via giget)

import type { Template } from "./index.js";

export const minimal: Template = {
  id: "minimal",
  secrets: [],
  files: (agent) => [
    // ── Agent entry ──────────────────────────────────────────────────────
    {
      path: `agents/${agent}/index.ts`,
      content: `import { asAgentId, defineAgent } from "@kalphq/sdk";
import { exampleStep } from "./steps/example-step.js";
import { transformData } from "./steps/transform-data.js";
import { exampleTool } from "./tools/example-tool.js";
import { httpRequest } from "./tools/http-request.js";
import { genericInbound } from "./webhooks/generic-inbound.js";
import { healthCheck } from "./webhooks/health-check.js";
import { taskComplete } from "./signals/task-complete.js";
import { errorAlert } from "./signals/error-alert.js";

export default defineAgent({
  id: asAgentId("${agent}"),
  name: "${agent}",
  steps: [exampleStep, transformData],
  tools: [exampleTool, httpRequest],
  webhooks: [genericInbound, healthCheck],
  signals: [taskComplete, errorAlert],

  async onMessage(message, ctx) {
    const stepped = await ctx.runStep(exampleStep, { message: message.text });
    const tooled = await ctx.callTool(exampleTool, { query: message.text });
    return { text: \`\${stepped.result} | \${tooled.output}\` };
  },
});
`,
    },
    // ── Steps ────────────────────────────────────────────────────────────
    {
      path: `agents/${agent}/steps/example-step.ts`,
      content: `import { createStep } from "@kalphq/sdk";
import { z } from "zod";

export const exampleStep = createStep({
  id: "example_step",
  description: "A stub step — replace with your own logic.",
  input: z.object({ message: z.string() }),
  output: z.object({ result: z.string() }),
  async run({ message }) {
    return { result: \`Processed: \${message}\` };
  },
});
`,
    },
    {
      path: `agents/${agent}/steps/transform-data.ts`,
      content: `import { createStep } from "@kalphq/sdk";
import { z } from "zod";

export const transformData = createStep({
  id: "transform_data",
  description: "Transforms input data to a standardized format.",
  input: z.object({
    data: z.record(z.unknown()),
    format: z.string(),
  }),
  output: z.object({
    transformed: z.boolean(),
    result: z.record(z.unknown()),
    format: z.string(),
  }),
  async run({ data, format }) {
    const result = {};
    for (const [key, value] of Object.entries(data)) {
      const normalizedKey = key.replace(/[A-Z]/g, (letter) => \`_\${letter.toLowerCase()}\`);
      result[normalizedKey] = value;
    }
    return { transformed: true, result, format: format.toLowerCase() };
  },
});
`,
    },
    // ── Tools ────────────────────────────────────────────────────────────
    {
      path: `agents/${agent}/tools/example-tool.ts`,
      content: `import { createTool } from "@kalphq/sdk";
import { z } from "zod";

export const exampleTool = createTool({
  id: "example_tool",
  description: "A stub tool — replace with your own external call.",
  input: z.object({ query: z.string() }),
  async execute({ query }) {
    return { output: \`Result for: \${query}\` };
  },
});
`,
    },
    {
      path: `agents/${agent}/tools/http-request.ts`,
      content: `import { createTool } from "@kalphq/sdk";
import { z } from "zod";

export const httpRequest = createTool({
  id: "http_request",
  description: "Generic HTTP client for external API calls.",
  input: z.object({
    url: z.string(),
    method: z.string().default("GET"),
    headers: z.record(z.string()).optional(),
    body: z.string().optional(),
  }),
  async execute({ url, method, headers, body }) {
    return {
      statusCode: 200,
      status: "ok",
      url,
      method,
      bodyLength: body?.length ?? 0,
      timestamp: new Date().toISOString(),
    };
  },
});
`,
    },
    // ── Webhooks ─────────────────────────────────────────────────────────
    {
      path: `agents/${agent}/webhooks/generic-inbound.ts`,
      content: `import { defineWebhook } from "@kalphq/sdk";
import { z } from "zod";

export const genericInbound = defineWebhook({
  id: "generic_inbound",
  input: z.object({
    event: z.string(),
    payload: z.record(z.unknown()),
    timestamp: z.string().optional(),
  }),
  async handler({ event, payload }) {
    return {
      received: true,
      event,
      payloadKeys: Object.keys(payload),
      processedAt: new Date().toISOString(),
    };
  },
});
`,
    },
    {
      path: `agents/${agent}/webhooks/health-check.ts`,
      content: `import { defineWebhook } from "@kalphq/sdk";
import { z } from "zod";

export const healthCheck = defineWebhook({
  id: "health_check",
  input: z.object({
    check: z.string().default("ping"),
  }),
  async handler({ check }) {
    return {
      status: "healthy",
      check,
      uptime: "100%",
      timestamp: new Date().toISOString(),
    };
  },
});
`,
    },
    // ── Signals ──────────────────────────────────────────────────────────
    {
      path: `agents/${agent}/signals/task-complete.ts`,
      content: `import { createSignal } from "@kalphq/sdk";
import { z } from "zod";

export const taskComplete = createSignal({
  id: "task_complete",
  input: z.object({
    taskId: z.string(),
    result: z.string(),
    duration: z.number(),
  }),
  async handler({ taskId, result, duration }) {
    return {
      acknowledged: true,
      taskId,
      status: "completed",
      duration,
    };
  },
});
`,
    },
    {
      path: `agents/${agent}/signals/error-alert.ts`,
      content: `import { createSignal } from "@kalphq/sdk";
import { z } from "zod";

export const errorAlert = createSignal({
  id: "error_alert",
  input: z.object({
    errorId: z.string(),
    message: z.string(),
    severity: z.string(),
    context: z.record(z.unknown()).optional(),
  }),
  async handler({ errorId, message, severity }) {
    return {
      logged: true,
      errorId,
      severity,
      alertSent: severity === "high" || severity === "critical",
    };
  },
});
`,
    },
  ],
};
