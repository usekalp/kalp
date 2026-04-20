import { access } from "node:fs/promises";
import { join } from "node:path";
import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { ensureConfig } from "@/utils/fs";
import { readLatestVersionedManifest } from "@/utils/manifest";

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
    try {
      await access(agentPath);
    } catch {
      p.log.error(
        `Agent ${pc.cyan(agentName)} not found at ${pc.cyan(`agents/${agentName}/index.ts`)}`,
      );
      process.exit(1);
    }

    const s = p.spinner();
    s.start(`Loading latest migration for ${pc.cyan(agentName)}`);

    const version = await readLatestVersionedManifest({ cwd, agentName }).catch(
      () => null,
    );

    if (!version) {
      s.stop(pc.red("No migration found"));
      p.log.info(
        pc.dim(
          `Run ${pc.cyan(`kalp migrate -a ${agentName}`)} before pushing.`,
        ),
      );
      process.exit(1);
    }

    s.stop(`Using migration ${pc.cyan(version.versionId)}`);

    // ── Output JSON ─────────────────────────────────────────────────────────
    console.log("\n" + pc.dim("─".repeat(50)));
    console.log(pc.cyan("Agent Manifest (JSON):"));
    console.log(pc.dim("─".repeat(50)));
    console.log(JSON.stringify(version, null, 2));
    console.log(pc.dim("─".repeat(50)) + "\n");
    p.log.info(`${pc.cyan("Saved")}: ${version.outputPath}`);

    p.outro(
      `${LOGO} ${pc.green("Migration ready")} ${pc.dim("— versioned in meta/migrations")}`,
    );
  },
});
