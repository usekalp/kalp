import {
  writeFile,
  readFile,
  readdir,
  cp,
  mkdir,
  access,
} from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { format } from "prettier";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const TEMPLATES_DIR = join(__dirname, "..", "templates");

async function formatGeneratedFile(
  filePath: string,
  content: string,
): Promise<string> {
  if (!filePath.endsWith(".ts") && !filePath.endsWith(".tsx")) {
    return content;
  }

  try {
    return await format(content, {
      parser: "typescript",
      semi: true,
      singleQuote: false,
      trailingComma: "all",
      printWidth: 80,
    });
  } catch {
    return content;
  }
}

async function replacePlaceholders(
  dir: string,
  map: Record<string, string>,
): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fp = join(dir, entry.name);
    if (entry.isDirectory()) {
      await replacePlaceholders(fp, map);
    } else if (entry.isFile() && entry.name !== ".gitkeep") {
      try {
        let src = await readFile(fp, "utf-8");
        let changed = false;
        for (const [from, to] of Object.entries(map)) {
          if (src.includes(from)) {
            src = src.replaceAll(from, to);
            changed = true;
          }
        }
        if (changed) {
          const formatted = await formatGeneratedFile(fp, src);
          await writeFile(fp, formatted, "utf-8");
        }
      } catch {
        // binary file — skip
      }
    }
  }
}

export async function scaffoldProject(opts: {
  projectName: string;
  targetDir: string;
}): Promise<void> {
  const { projectName, targetDir } = opts;

  // ── Copy project template (flat) to target directory ──────────────────
  await cp(join(TEMPLATES_DIR, "project"), targetDir, {
    recursive: true,
    force: true,
  });

  // ── Ensure .gitignore exists (cp may skip dotfiles on Windows) ────────
  const gitignorePath = join(targetDir, ".gitignore");
  try {
    await access(gitignorePath);
  } catch {
    await writeFile(
      gitignorePath,
      "node_modules/\ndist/\n.turbo/\n.temp/\n.env\n*.log\n",
      "utf-8",
    );
  }

  // ── Create .temp directory with version info (project local) ───────────
  const tempDir = join(targetDir, ".temp");
  await mkdir(tempDir, { recursive: true });

  const versionInfo = {
    cliVersion: "0.0.2",
    createdAt: new Date().toISOString(),
    projectName,
  };
  await writeFile(
    join(tempDir, "version.json"),
    JSON.stringify(versionInfo, null, 2),
    "utf-8",
  );

  // ── kalp.config.ts ────────────────────────────────────────────────────
  const kalpConfig = `import { defineConfig } from "@kalphq/sdk";

export default defineConfig({
  secrets: [],
});
`;
  await writeFile(join(targetDir, "kalp.config.ts"), kalpConfig, "utf-8");

  // ── Replace placeholders across the whole target ──────────────────────
  await replacePlaceholders(targetDir, { __PROJECT_NAME__: projectName });
}

export async function scaffoldAgent(opts: {
  agentName: string;
  cwd: string;
}): Promise<void> {
  const { agentName, cwd } = opts;
  const agentDir = join(cwd, "agents", agentName);

  await mkdir(join(agentDir, "steps"), { recursive: true });
  await mkdir(join(agentDir, "tools"), { recursive: true });
  await mkdir(join(agentDir, "routes"), { recursive: true });
  await mkdir(join(agentDir, "flows"), { recursive: true });

  // ── Agent index.ts ────────────────────────────────────────────────────
  const agentIndex = `// Define behavior using normal JavaScript.
// Kalp compiles this into a distributed execution graph (IR).
import { asAgentId, defineAgent } from "@kalphq/sdk";
import { processQuery } from "@/${agentName}/steps/process-query";
import { formatResponse } from "@/${agentName}/steps/format-response";
import { searchTool } from "@/${agentName}/tools/search";
import { healthRoute } from "@/${agentName}/routes/health";

export default defineAgent({
  id: asAgentId("${agentName}"),
  name: "${agentName}",
  description: "A helpful AI assistant",

  // Optional — compiler infers from actions.run(), but these help with validation and tooling
  steps: [processQuery, formatResponse],
  tools: [searchTool],

  routes: [healthRoute],

  async onMessage({ message, actions, ai }) {
    // Pattern: classify → if/else
    // The compiler transforms this into branching execution in the IR
    const intent = await ai.classify({
      input: message.text,
      labels: ["research", "chat"],
      model: "openai/gpt-4o-mini",
    });

    if (intent === "research") {
      // Detached loop — scheduled in Durable Object
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

  // ── Step: process-query.ts ────────────────────────────────────────────
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
  async run({ query }) {
    return {
      enhanced: query.trim(),
      intent: "basic",
    };
  },
});`;

  // ── Step: format-response.ts ──────────────────────────────────────────
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
  async run({ text, sources }) {
    const formatted = sources?.length
      ? \`\${text}\\n\\nSources: \${sources.join(", ")}\`
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

  // ── Tool: search.ts ───────────────────────────────────────────────────
  const toolFile = `import { defineTool } from "@kalphq/sdk";
import { z } from "zod";

export const searchTool = defineTool({
  id: "search",
  description: "Search for relevant information",
  inputSchema: z.object({ query: z.string(), limit: z.number().default(3) }),
  async execute({ query, limit }) {
    // Simulated search - replace with real API call
    const results = [
      { title: "Result 1", snippet: \`Info about: \${query}\` },
      { title: "Result 2", snippet: "More relevant content..." },
    ].slice(0, limit);

    return { results, total: results.length };
  },
});`;

  // ── Route: health.ts ──────────────────────────────────────────────────
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

  // ── Flow: chat-flow.ts ────────────────────────────────────────────────
  const flowFile = `// Optional composition helper — compiled into the execution graph.
// Not required for execution.
import { defineFlow } from "@kalphq/sdk";
import { processQuery } from "@/${agentName}/steps/process-query";
import { formatResponse } from "@/${agentName}/steps/format-response";

export const chatFlow = defineFlow({
  id: "chat_flow",
  description: "Process user message through query analysis and formatting",
  steps: [processQuery, formatResponse],
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
  await writeFile(join(agentDir, "flows", "chat-flow.ts"), flowFile, "utf-8");
}
