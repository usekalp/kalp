import { existsSync } from "node:fs";
import { access, mkdtemp, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import { build } from "esbuild";
import pc from "picocolors";
import type { ZodTypeAny } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ensureConfig } from "../utils/fs.js";

const LOGO = "🦋";

type JsonSchema = Record<string, unknown>;

interface AgentItemWithInput {
  id?: unknown;
  description?: unknown;
  input?: unknown;
}

interface AgentStepItem extends AgentItemWithInput {
  output?: unknown;
}

interface LoadedAgentModule {
  agent: unknown;
  tempDir: string;
}

function toJsonSchema(schema: unknown, name: string): JsonSchema | null {
  try {
    return zodToJsonSchema(schema as ZodTypeAny, name) as JsonSchema;
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function serializeSteps(steps: unknown[]): Record<string, unknown>[] {
  return steps.map((step, index) => {
    const item = asRecord(step) as AgentStepItem;
    return {
      id: asString(item.id) ?? `step_${index}`,
      description: asString(item.description) ?? "",
      inputSchema: toJsonSchema(item.input, `step_${index}_input`),
      outputSchema: toJsonSchema(item.output, `step_${index}_output`),
    };
  });
}

function serializeItems(
  items: unknown[],
  kind: "tool" | "webhook" | "signal",
): Record<string, unknown>[] {
  return items.map((item, index) => {
    const parsed = asRecord(item) as AgentItemWithInput;
    return {
      id: asString(parsed.id) ?? `${kind}_${index}`,
      description: asString(parsed.description) ?? "",
      inputSchema: toJsonSchema(parsed.input, `${kind}_${index}_input`),
    };
  });
}

async function loadAgentModule(
  agentPath: string,
  cwd: string,
): Promise<LoadedAgentModule> {
  const tempDir = await mkdtemp(join(cwd, ".kalp-push-"));
  const outFile = join(tempDir, "agent.preview.mjs");

  await build({
    entryPoints: [agentPath],
    outfile: outFile,
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node18",
    logLevel: "silent",
    packages: "external",
    plugins: [
      {
        name: "relative-js-to-ts",
        setup(buildCtx) {
          buildCtx.onResolve({ filter: /^\.+\/.*\.js$/ }, (args) => {
            const resolved = resolve(args.resolveDir, args.path);
            if (existsSync(resolved)) {
              return { path: resolved };
            }

            const tsPath = resolved.replace(/\.js$/, ".ts");
            if (existsSync(tsPath)) {
              return { path: tsPath };
            }

            const tsxPath = resolved.replace(/\.js$/, ".tsx");
            if (existsSync(tsxPath)) {
              return { path: tsxPath };
            }

            return null;
          });
        },
      },
    ],
  });

  const loaded = (await import(
    `${pathToFileURL(outFile).href}?t=${Date.now()}`
  )) as { default?: unknown };

  return {
    agent: loaded.default,
    tempDir,
  };
}

export default defineCommand({
  meta: { name: "push", description: "Push an agent to Kalp (preview mode)" },
  args: {
    agent: {
      type: "string",
      alias: "a",
      description: "Agent name to push",
      required: false,
    },
  },
  async run({ args }) {
    const cwd = process.cwd();

    p.intro(`${LOGO} ${pc.bold("kalp push")}`);

    // ── Validate agent name ─────────────────────────────────────────────────
    const agentName = args.agent;
    if (!agentName) {
      p.log.error(`Missing required flag ${pc.cyan("-a <agent-name>")}`);
      p.outro(pc.dim(`Example: ${pc.cyan("kalp push -a my-agent")}`));
      process.exit(1);
    }

    // ── Validate kalp.config.ts exists ─────────────────────────────────────
    try {
      await ensureConfig(cwd);
    } catch {
      p.log.error(`${pc.cyan("kalp.config.ts")} not found`);
      p.outro(pc.dim(`Run ${pc.cyan("kalp init")} first.`));
      process.exit(1);
    }

    // ── Find agent ──────────────────────────────────────────────────────────
    const agentPath = join(cwd, "agents", agentName, "index.ts");
    try {
      await access(agentPath);
    } catch {
      p.log.error(
        `Agent ${pc.cyan(agentName)} not found at ${pc.cyan(`agents/${agentName}/index.ts`)}`,
      );
      process.exit(1);
    }

    const s = p.spinner();
    s.start(`Parsing agent ${pc.cyan(agentName)}`);
    let tempDir: string | undefined;
    let agentConfig: Record<string, unknown>;

    try {
      const loaded = await loadAgentModule(agentPath, cwd);
      tempDir = loaded.tempDir;

      const agent = asRecord(loaded.agent);
      agentConfig = {
        id: asString(agent.id) ?? undefined,
        name: asString(agent.name) ?? agentName,
        description: asString(agent.description) ?? "",
        source: agentPath,
        systemPrompt: asString(agent.systemPrompt) ?? "",
        steps: serializeSteps(asArray(agent.steps)),
        tools: serializeItems(asArray(agent.tools), "tool"),
        webhooks: serializeItems(asArray(agent.webhooks), "webhook"),
        signals: serializeItems(asArray(agent.signals), "signal"),
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      s.stop(pc.red("Could not parse agent module"));
      p.log.info(pc.dim(msg.split("\n")[0] ?? "Unknown error"));
      process.exit(1);
    } finally {
      if (tempDir) {
        await rm(tempDir, { recursive: true, force: true });
      }
    }

    s.stop("Agent parsed");

    // ── Output JSON ─────────────────────────────────────────────────────────
    console.log("\n" + pc.dim("─".repeat(50)));
    console.log(pc.cyan("Agent Configuration (JSON):"));
    console.log(pc.dim("─".repeat(50)));
    console.log(JSON.stringify(agentConfig, null, 2));
    console.log(pc.dim("─".repeat(50)) + "\n");

    p.outro(
      `${LOGO} ${pc.green("Preview ready")} ${pc.dim("— push to deploy coming soon")}`,
    );
  },
});
