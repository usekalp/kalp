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
import { generateTypes, updateKalpDts, updateTsconfig } from "@/utils/codegen";

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
      "node_modules/\ndist/\n.env\n*.log\n.turbo/\n.temp/\n",
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

  // ── Generate types and kalp.d.ts ──────────────────────────────────────
  await generateTypes(targetDir);
  await updateKalpDts(targetDir);
  await updateTsconfig(targetDir);

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

  const agentIndex = `import { asAgentId, defineAgent } from "@kalphq/sdk";
import { processQuery } from "@/${agentName}/steps/process-query";
import { formatResponse } from "@/${agentName}/steps/format-response";
import { searchTool } from "@/${agentName}/tools/search";
import { healthRoute } from "@/${agentName}/routes/health";
import { chatFlow } from "@/${agentName}/flows/chat-flow";

export default defineAgent({
  id: asAgentId("${agentName}"),
  name: "${agentName}",
  description: "A helpful AI assistant",
  steps: [processQuery, formatResponse],
  tools: [searchTool],
  routes: [healthRoute],
  flows: [chatFlow],

  async onMessage({ message, ctx, actions }) {
    const stream = actions.ai.stream({
      model: "openai/gpt-4o-mini",
      system: "You are a helpful assistant.",
      prompt: message.text,
    });

    return stream;
  },
});`;

  const stepProcessFile = `import { createStep } from "@kalphq/sdk";
import { z } from "zod";

export const processQuery = createStep({
  id: "process_query",
  description: "Analyze and enhance user query",
  input: z.object({ query: z.string() }),
  output: z.object({
    enhanced: z.string(),
    intent: z.string(),
    needsSearch: z.boolean(),
  }),
  async run({ query }) {
    // Simple intent detection
    const intent = query.includes("?") ? "question" : "statement";
    const needsSearch = query.toLowerCase().includes("search") || query.includes("?");

    return {
      enhanced: query.trim(),
      intent,
      needsSearch,
    };
  },
});`;

  const stepFormatFile = `import { createStep } from "@kalphq/sdk";
import { z } from "zod";

export const formatResponse = createStep({
  id: "format_response",
  description: "Format final response with metadata",
  input: z.object({
    text: z.string(),
    sources: z.array(z.string()).optional(),
  }),
  output: z.object({
    formatted: z.string(),
    meta: z.object({ timestamp: z.number(), version: z.string() }),
  }),
  async run({ text, sources }) {
    const formatted = sources?.length
      ? \`\${text}\\n\\nSources: \${sources.join(", ")}\`
      : text;

    return {
      formatted,
      meta: {
        timestamp: Date.now(),
        version: "1.0.0",
      },
    };
  },
});`;

  const toolFile = `import { createTool } from "@kalphq/sdk";
import { z } from "zod";

export const searchTool = createTool({
  id: "search",
  description: "Search for relevant information",
  input: z.object({ query: z.string(), limit: z.number().default(3) }),
  async execute({ query, limit }) {
    // Simulated search - replace with real API call
    const results = [
      { title: "Result 1", snippet: \`Info about: \${query}\` },
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
  handler: async (_req, res, { ctx }) => {
    res.json({
      status: "ok",
      agent: "${agentName}",
      timestamp: new Date().toISOString(),
    });
  },
});`;

  const flowFile = `import { defineFlow } from "@kalphq/sdk";
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
