import { access } from "node:fs/promises";
import { join } from "node:path";
import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { ensureConfig } from "@/utils/fs";
import { readAgentManifest, getIRHash } from "@/utils/manifest";

const LOGO = "🦋";
const CLOUD_API = process.env.KALP_CLOUD_URL || "http://localhost:3000";

export default defineCommand({
  meta: { name: "push", description: "Push agent to Kalp cloud" },
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
    const agentName = args.agent;

    p.intro(`${LOGO} ${pc.bold("kalp push")}`);

    if (!agentName) {
      p.log.error(`Missing required flag ${pc.cyan("-a <agent-name>")}`);
      process.exit(1);
    }

    try {
      await ensureConfig(cwd);
    } catch {
      p.log.error(`${pc.cyan("kalp.config.ts")} not found`);
      process.exit(1);
    }

    const agentPath = join(cwd, "agents", agentName, "index.ts");
    try {
      await access(agentPath);
    } catch {
      p.log.error(`Agent ${pc.cyan(agentName)} not found`);
      process.exit(1);
    }

    const s = p.spinner();
    s.start(`Compiling ${pc.cyan(agentName)}`);

    const manifest = await readAgentManifest({ cwd, agentName });
    const hash = getIRHash(manifest.ir);

    s.stop(`Compiled ${pc.cyan(agentName)}`);
    s.start(`Pushing to cloud`);

    const response = await fetch(`${CLOUD_API}/api/agents/push`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentName,
        ir: manifest.ir,
        hash,
      }),
    });

    if (!response.ok) {
      s.stop(pc.red("Push failed"));
      p.log.error(`Cloud error: ${response.status}`);
      process.exit(1);
    }

    s.stop(pc.green("Pushed successfully"));

    console.log("\n" + pc.dim("─".repeat(50)));
    console.log(pc.cyan("✔ deployed"));
    console.log("");
    console.log(`${pc.bold("agent:")} ${agentName}`);
    console.log(`${pc.bold("hash:")} ${hash}`);
    console.log(pc.dim("─".repeat(50)) + "\n");

    p.outro(`${LOGO} ${pc.green("Agent pushed to cloud")}`);
  },
});
