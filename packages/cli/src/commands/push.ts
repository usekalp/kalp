import { access, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { execa } from "execa";
import { ensureConfig } from "@/utils/fs";
import { readAgentManifest, computePushHash } from "@/utils/manifest";
import { requireAuth } from "@/utils/auth";
import { runInitialDeploy } from "@/utils/deploy";
import {
  type ProjectAgentState,
  type ProjectState,
  readProjectState,
  writeProjectState,
} from "@/utils/project-state";
import { validateCompiledIR } from "@/utils/validate";
import { materializeRuntime, readLocalAgentNames } from "@/utils/runtime";

const LOGO = "🦋";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function createInitialState(): ProjectState {
  return {
    workerUrl: null,
    deployedAt: null,
    accountId: null,
    agents: {},
  };
}

function ensureAgentState(
  state: ProjectState,
  agentName: string,
  localPath: string,
): ProjectAgentState {
  const existing = state.agents[agentName];
  if (existing) {
    existing.localPath = localPath;
    return existing;
  }

  const created: ProjectAgentState = {
    currentHash: null,
    currentVersion: 0,
    lastLocalHash: null,
    lastRemoteHash: null,
    lastPushedAt: null,
    localPath,
    workerUrl:
      state.workerUrl ? `${state.workerUrl.replace(/\/$/, "")}/a/${agentName}` : null,
  };
  state.agents[agentName] = created;
  return created;
}

type PushTarget = "local" | "remote";

interface PushResult {
  pushed: number;
  skipped: number;
  failed: number;
}

async function pushRemoteManifest(params: {
  cwd: string;
  wranglerConfigPath: string;
  agentName: string;
  hash: string;
  ir: unknown;
}): Promise<void> {
  const { cwd, wranglerConfigPath, agentName, hash, ir } = params;
  const manifestKey = `${agentName}:${hash}`;
  const latestKey = `${agentName}:latest`;
  const manifestPath = join(cwd, ".kalp", `${agentName}-${hash}.json`);
  await mkdir(join(cwd, ".kalp"), { recursive: true });
  await writeFile(manifestPath, JSON.stringify(ir), "utf-8");

  try {
    await execa(
      "npx",
      [
        "wrangler",
        "kv",
        "key",
        "put",
        "--binding",
        "KALP_MANIFESTS",
        manifestKey,
        "--path",
        manifestPath,
        "--remote",
        "--config",
        wranglerConfigPath,
      ],
      { cwd },
    );

    await execa(
      "npx",
      [
        "wrangler",
        "kv",
        "key",
        "put",
        "--binding",
        "KALP_MANIFESTS",
        latestKey,
        hash,
        "--remote",
        "--config",
        wranglerConfigPath,
      ],
      { cwd },
    );
  } finally {
    await rm(manifestPath, { force: true });
  }
}

export default defineCommand({
  meta: { name: "push", description: "Push agent manifest to Cloudflare KV" },
  args: {
    agent: {
      type: "string",
      alias: "a",
      description: "Agent name to push",
      required: false,
    },
    local: {
      type: "boolean",
      description: "Update only local runtime snapshot and state",
      required: false,
      default: false,
    },
  },
  async run({ args }) {
    const cwd = process.cwd();
    const target: PushTarget = args.local ? "local" : "remote";

    p.intro(`${LOGO} ${pc.bold("kalp push")}`);

    await ensureConfig(cwd).catch(() => {
      p.log.error(`${pc.cyan("kalp.config.ts")} not found`);
      process.exit(1);
    });

    const availableAgents = await readLocalAgentNames(cwd);
    if (availableAgents.length === 0) {
      p.log.error("No local agents found in ./agents");
      process.exit(1);
    }

    let selectedAgents: string[] = [];
    if (args.agent) {
      if (!availableAgents.includes(args.agent)) {
        p.log.error(`Agent ${pc.cyan(args.agent)} not found`);
        process.exit(1);
      }
      selectedAgents = [args.agent];
    } else {
      selectedAgents = availableAgents;
    }

    let state = (await readProjectState(cwd)) ?? createInitialState();
    let runtime = await materializeRuntime(cwd, { mode: target });

    if (target === "remote") {
      await requireAuth().catch(() => {
        p.log.error("Not authenticated. Run `kalp login` first.");
        process.exit(1);
      });

      if (!state.workerUrl) {
        p.log.warn("No .kalp/state.json found. Running initial deploy first...");
        const deploy = await runInitialDeploy(cwd);
        state = (await readProjectState(cwd)) ?? createInitialState();
        state.workerUrl = deploy.workerUrl;
        state.accountId = deploy.accountId;
        state.deployedAt = new Date().toISOString();
      }

      runtime = await materializeRuntime(cwd, { mode: "remote" });
    }

    const spinner = p.spinner();
    const result: PushResult = { pushed: 0, skipped: 0, failed: 0 };
    const failures: string[] = [];

    for (const agentName of selectedAgents) {
      const agentPath = join(cwd, "agents", agentName, "index.ts");
      await access(agentPath).catch(() => {
        failures.push(`${agentName}: missing ${agentPath}`);
      });

      try {
        spinner.start(`Compiling ${pc.cyan(agentName)}`);
        const manifest = await readAgentManifest({ cwd, agentName });
        const hash = computePushHash(manifest.ir);
        const validation = validateCompiledIR({ agentName, ir: manifest.ir, hash });
        if (!validation.ok) {
          const details = (validation.errors ?? []).join(" | ");
          throw new Error(
            `validation failed (${validation.phase})${details ? `: ${details}` : ""}`,
          );
        }

        const agentState = ensureAgentState(state, agentName, agentPath);
        const previousHash =
          target === "local" ? agentState.lastLocalHash : agentState.lastRemoteHash;

        if (previousHash === hash) {
          result.skipped += 1;
          spinner.stop(`Skipped ${pc.cyan(agentName)} (no changes)`);
          continue;
        }

        if (target === "remote") {
          spinner.message("Uploading manifest to Cloudflare KV");
          await pushRemoteManifest({
            cwd,
            wranglerConfigPath: runtime.wranglerConfigPath,
            agentName,
            hash,
            ir: manifest.ir,
          });
        }

        agentState.currentVersion = Math.max(0, agentState.currentVersion) + 1;
        agentState.currentHash = hash;
        agentState.lastPushedAt = new Date().toISOString();
        agentState.workerUrl =
          state.workerUrl && target === "remote"
            ? `${state.workerUrl.replace(/\/$/, "")}/a/${agentName}`
            : agentState.workerUrl;

        if (target === "local") {
          agentState.lastLocalHash = hash;
        } else {
          agentState.lastRemoteHash = hash;
          agentState.lastLocalHash = hash;
        }

        const bundles = manifest.ir.bundles || {};
        const totalSize = Object.values(bundles).reduce(
          (sum, bundle) => sum + Buffer.byteLength(bundle.code),
          0,
        );
        const handlerCount = Object.keys(bundles).length;
        spinner.stop(
          `${pc.bold(agentName)} pushed ${pc.dim(`(v${agentState.currentVersion})`)} · ${handlerCount} handlers · ${formatBytes(totalSize)}`,
        );
        result.pushed += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push(`${agentName}: ${message}`);
        spinner.stop(`Failed ${pc.cyan(agentName)}`);
        result.failed += 1;
      }
    }

    await writeProjectState(cwd, state);
    await materializeRuntime(cwd, { mode: target });

    p.note(
      `Successfully pushed ${result.pushed} agents. ${result.skipped} omitted (no changes). ${result.failed} failed.`,
      target === "local" ? "Local push" : "Remote push",
    );

    if (failures.length > 0) {
      for (const failure of failures) {
        p.log.error(failure);
      }
      p.outro(`${LOGO} ${pc.red("Push completed with failures")}`);
      process.exit(1);
    }

    p.outro(`${LOGO} ${pc.green("Push complete")}`);
  },
});
