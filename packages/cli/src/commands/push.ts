import { access } from "node:fs/promises";
import { join } from "node:path";
import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { ensureConfig } from "@/utils/fs";
import { readAgentManifest, computePushHash } from "@/utils/manifest";
import { renderLegacyError } from "@/utils/issues";

const LOGO = "🦋";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function printPushResult(
  agentName: string,
  hash: string,
  handlers: Record<string, { size: number }>,
) {
  const div = pc.dim("─".repeat(48));
  const handlerCount = Object.keys(handlers).length;
  const totalSize = Object.values(handlers).reduce((sum, h) => sum + h.size, 0);

  console.log("\n" + div);
  console.log(pc.green("✔ Deployed"));
  console.log("");
  console.log(`  ${pc.bold(agentName)}  ${pc.dim(hash.slice(0, 7))}...`);
  console.log(
    `  ${pc.dim(String(handlerCount))} handlers · ${formatBytes(totalSize)}`,
  );
  console.log(div + "\n");
}

function printPushError(
  phase: string,
  errors: string[],
  blockers?: string[],
  verbose?: boolean,
) {
  const div = pc.dim("─".repeat(48));
  console.log("\n" + div);

  for (const e of errors) {
    console.log(renderLegacyError(e, verbose));
    console.log("");
  }

  if (phase === "analysis" && blockers) {
    for (const b of blockers) {
      console.log(pc.red(`✘ Blocker: ${b}`));
    }
  }

  if (!verbose) {
    console.log(pc.dim(`\nRun with --verbose for more details.\n`));
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
    verbose: {
      type: "boolean",
      alias: "v",
      description: "Show debug information",
      default: false,
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

    const bundles = (manifest.ir.bundles || {}) as Record<
      string,
      { code: string }
    >;
    const handlerCount = Object.keys(bundles).length;

    const hash = computePushHash(manifest.ir);

    s.stop(`Compiled ${pc.cyan(agentName)} — ${handlerCount} handlers`);

    s.start(`Checking for changes`);

    const statusResponse = await fetch(
      `http://localhost:3000/api/agents/${agentName}/status`,
    );

    const statusData = (await statusResponse.json().catch(() => null)) as {
      agentName: string;
      hash?: string;
      exists: boolean;
    } | null;

    if (statusData?.exists && statusData.hash === hash) {
      s.stop(pc.green("No changes detected"));
      p.note(
        `Agent ${pc.cyan(agentName)} is already deployed with the same logic.`,
        "Skipped",
      );
      p.outro(`${LOGO} ${pc.green("No deployment needed")}`);
      return;
    }

    s.start(`Pushing to cloud`);

    const response = await fetch(`http://localhost:3000/api/agents/push`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentName,
        ir: manifest.ir,
        hash,
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

    const displayHandlers = Object.entries(bundles).reduce(
      (acc, [hash, bundle]) => ({
        ...acc,
        [hash]: {
          size: Buffer.byteLength(bundle.code),
        },
      }),
      {} as Record<string, { size: number }>,
    );

    s.stop(pc.green("Pushed successfully"));
    printPushResult(agentName, hash, displayHandlers);

    const dashboardUrl = `http://localhost:3000/a/${agentName}`;
    p.outro(`${LOGO} ${pc.green("Agent live at")} ${pc.cyan(dashboardUrl)}`);

    process.exit(0);
  },
});
