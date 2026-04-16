import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { ensureConfig } from "../utils/fs.js";

const LOGO = "🦋";

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
    let agentCode: string;
    try {
      agentCode = await readFile(agentPath, "utf-8");
    } catch {
      p.log.error(
        `Agent ${pc.cyan(agentName)} not found at ${pc.cyan(`agents/${agentName}/index.ts`)}`,
      );
      process.exit(1);
    }

    const s = p.spinner();
    s.start(`Parsing agent ${pc.cyan(agentName)}`);

    // ── Parse agent config from TypeScript ──────────────────────────────────
    // Extract defineAgent({...}) call using regex
    const defineAgentMatch = agentCode.match(
      /defineAgent\(\s*(\{[\s\S]*?\})\s*\)/,
    );
    if (!defineAgentMatch?.[1]) {
      s.stop(pc.red("Could not parse defineAgent call"));
      process.exit(1);
    }

    // Extract steps and tools arrays for schema generation
    const stepMatches = [
      ...agentCode.matchAll(/createStep\(\s*(\{[\s\S]*?\})\s*\)/g),
    ];
    const toolMatches = [
      ...agentCode.matchAll(/createTool\(\s*(\{[\s\S]*?\})\s*\)/g),
    ];

    const steps = stepMatches.map((match, i) => {
      const content = match[1] ?? "";
      const idMatch = content.match(/id:\s*["']([^"']+)["']/);
      const descMatch = content.match(/description:\s*["']([^"']+)["']/);
      return {
        id: idMatch?.[1] ?? `step_${i}`,
        description: descMatch?.[1] ?? "",
      };
    });

    const tools = toolMatches.map((match, i) => {
      const content = match[1] ?? "";
      const idMatch = content.match(/id:\s*["']([^"']+)["']/);
      const descMatch = content.match(/description:\s*["']([^"']+)["']/);
      return {
        id: idMatch?.[1] ?? `tool_${i}`,
        description: descMatch?.[1] ?? "",
      };
    });

    // ── Build JSON representation ───────────────────────────────────────────
    const agentConfig = {
      name: agentName,
      source: agentPath,
      steps,
      tools,
      // Future: full AST parsing with Zod schema extraction
    };

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
