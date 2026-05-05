import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

export interface ScaffoldAgentOptions {
  agentName: string;
  cwd: string;
}

/**
 * Scaffolds a new agent with steps, tools, and routes.
 */
export async function scaffoldAgent(opts: ScaffoldAgentOptions): Promise<void> {
  const { agentName, cwd } = opts;
  const agentDir = join(cwd, "agents", agentName);

  await mkdir(join(agentDir, "steps"), { recursive: true });
  await mkdir(join(agentDir, "tools"), { recursive: true });
  await mkdir(join(agentDir, "routes"), { recursive: true });

  const agentIndex = `
import { defineAgent } from "@kalphq/sdk";
import { processQuery } from "@/${agentName}/steps/process-query";
import { formatResponse } from "@/${agentName}/steps/format-response";
import { searchTool } from "@/${agentName}/tools/search";
import { healthRoute } from "@/${agentName}/routes/health";

export default defineAgent({
  name: "${agentName}",
  description: "A helpful AI assistant",

  routes: [healthRoute],

  async onMessage({ message, actions, ai }) {
    // Pattern: classify → if/else
    const intent = await ai.classify({
      input: message.text,
      labels: ["research", "chat"],
      model: "openai/gpt-4o-mini",
    });

    if (intent === "research") {
      // Detached loop
      actions.loop(async () => {
        await actions.run(processQuery, { query: message.text });
        await actions.wait("1h");
      });
      return { text: "Research loop started." };
    }

    return ai.stream({
      model: "openai/gpt-4o-mini",
      system: "You are a helpful assistant.",
      prompt: message.text,
    });
  },
});`;

  const stepProcessFile = `import { defineStep } from "@kalphq/sdk";
import { z } from "zod";

export const processQuery = defineStep({
  id: "process_query",
  description: "Analyze and enhance user query",
  inputSchema: z.object({ query: z.string() }),
  outputSchema: z.object({
    enhanced: z.string(),
    intent: z.string(),
  }),
  // Simple example — use ai.generate() for advanced processing
  async handler({ query }) {
    return {
      enhanced: query.trim(),
      intent: "basic",
    };
  },
});`;

  const stepFormatFile = `import { defineStep } from "@kalphq/sdk";
import { z } from "zod";

export const formatResponse = defineStep({
  id: "format_response",
  description: "Format final response with metadata",
  inputSchema: z.object({
    text: z.string(),
    sources: z.array(z.string()).optional(),
  }),
  outputSchema: z.object({
    formatted: z.string(),
    meta: z.object({ timestamp: z.string(), version: z.string() }),
  }),
  async handler({ text, sources }) {
    const formatted = sources?.length
      ? text + "\\n\\nSources: " + sources.join(", ")
      : text;

    return {
      formatted,
      meta: {
        timestamp: new Date().toISOString(),
        version: "1.0.0",
      },
    };
  },
});`;

  const toolFile = `import { defineTool } from "@kalphq/sdk";
import { z } from "zod";

export const searchTool = defineTool({
  id: "search",
  description: "Search for relevant information",
  inputSchema: z.object({ query: z.string(), limit: z.number().default(3) }),
  async handler({ query, limit }) {
    // Simulated search - replace with real API call
    const results = [
      { title: "Result 1", snippet: "Info about: " + query },
      { title: "Result 2", snippet: "More relevant content..." },
    ].slice(0, limit);

    return { results, total: results.length };
  },
});`;

  const routeFile = `import { defineRoute } from "@kalphq/sdk";

export const healthRoute = defineRoute({
  id: "health",
  method: "GET",
  path: "/health",
  handler: async (_req, res) => {
    res.json({
      status: "ok",
      agent: "${agentName}",
      timestamp: new Date().toISOString(),
    });
  },
});`;

  await writeFile(join(agentDir, "index.ts"), agentIndex, "utf-8");
  await writeFile(
    join(agentDir, "steps", "process-query.ts"),
    stepProcessFile,
    "utf-8",
  );
  await writeFile(
    join(agentDir, "steps", "format-response.ts"),
    stepFormatFile,
    "utf-8",
  );
  await writeFile(join(agentDir, "tools", "search.ts"), toolFile, "utf-8");
  await writeFile(join(agentDir, "routes", "health.ts"), routeFile, "utf-8");
}
