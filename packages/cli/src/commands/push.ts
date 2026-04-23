import { access } from "node:fs/promises";
import { join } from "node:path";
import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { ensureConfig } from "@/utils/fs";
import { readAgentManifest, computePushHash } from "@/utils/manifest";

const LOGO = "🦋";
const CLOUD_API = process.env.KALP_CLOUD_URL || "http://localhost:3000";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function printPushResult(
  agentName: string,
  hash: string,
  handlers: Record<string, { size: number }>,
  analysis: Array<{
    name: string;
    capabilities: string[];
    warnings: string[];
    blockers: string[];
  }>,
) {
  const div = pc.dim("─".repeat(48));
  console.log("\n" + div);
  console.log(pc.green("✔ Deployed"));
  console.log("");
  console.log(`${pc.bold("agent:")}    ${agentName}`);
  console.log(`${pc.bold("hash:")}     ${hash.slice(0, 16)}...`);
  console.log(`${pc.bold("handlers:")} ${Object.keys(handlers).length}`);

  for (const [name, h] of Object.entries(handlers)) {
    const padded = name.padEnd(28);
    console.log(`  ${pc.dim(padded)} ${formatBytes(h.size)}`);
  }

  const allCaps = [...new Set(analysis.flatMap((a) => a.capabilities))];
  if (allCaps.length > 0) {
    console.log("");
    console.log(`${pc.bold("capabilities:")}`);
    console.log(`  ${pc.cyan(allCaps.join(", "))}`);
  }

  const allWarnings = analysis.flatMap((a) =>
    a.warnings.map((w) => `${w} in ${a.name}`),
  );
  if (allWarnings.length > 0) {
    console.log("");
    console.log(pc.yellow("⚠ warnings:"));
    for (const w of allWarnings) {
      console.log(`  ${pc.yellow(w)}`);
    }
  }

  const allBlockers = analysis.flatMap((a) =>
    a.blockers.map((b) => `${b} in ${a.name}`),
  );
  if (allBlockers.length === 0) {
    console.log("");
    console.log(pc.green("✔ blockers: none"));
  }

  console.log(div + "\n");
}

function printPushError(phase: string, errors: string[], blockers?: string[]) {
  const div = pc.dim("─".repeat(48));
  console.log("\n" + div);
  if (phase === "ir") {
    for (const e of errors) console.log(pc.red(`✘ invalid IR: ${e}`));
  } else if (phase === "bindings") {
    for (const e of errors) console.log(pc.red(`✘ handler missing: ${e}`));
  } else if (phase === "analysis" && blockers) {
    for (const b of blockers) console.log(pc.red(`✘ blockers found: ${b}`));
  } else {
    for (const e of errors) console.log(pc.red(`✘ ${e}`));
  }
  console.log(div + "\n");
}

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
    const hash = computePushHash(manifest.ir, manifest.handlers);

    s.stop(
      `Compiled ${pc.cyan(agentName)} — ${Object.keys(manifest.handlers).length} handlers`,
    );
    s.start(`Pushing to cloud`);

    const response = await fetch(`${CLOUD_API}/api/agents/push`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentName,
        ir: manifest.ir,
        hash,
        bundle: { handlers: manifest.handlers },
      }),
    });

    const body = (await response.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;

    if (!response.ok) {
      s.stop(pc.red("Push failed"));
      const phase = (body?.phase as string) ?? "unknown";
      const errors = (body?.errors as string[]) ?? [`HTTP ${response.status}`];
      const blockers = body?.blockers as string[] | undefined;
      printPushError(phase, errors, blockers);
      process.exit(1);
    }

    s.stop(pc.green("Pushed successfully"));

    const analysis =
      (body?.analysis as Array<{
        name: string;
        capabilities: string[];
        warnings: string[];
        blockers: string[];
      }>) ?? [];
    printPushResult(agentName, hash, manifest.handlers, analysis);

    p.outro(`${LOGO} ${pc.green("Agent pushed to cloud")}`);
  },
});
