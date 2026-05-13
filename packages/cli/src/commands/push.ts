import { access, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import pc from "picocolors";
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
import { resolveProvider } from "@/utils/providers";
import { exportCompiledIrForDebug } from "@/utils/ir/export";
import { promptDeployTarget, showKalpCloudWaitlist } from "@/utils/deploy-target";

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
    studioCredentialsFingerprint: null,
    serviceKeyFingerprint: null,
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

interface RemoteAgentIndexEntry {
  name: string;
  hash: string;
  version: string | null;
  versionNumber: number | null;
  updatedAt: string;
  workerUrl: string | null;
  label?: string;
  tags?: string[];
}

interface PruneResult {
  removedAgents: string[];
  deletedKeys: number;
}

async function readRemoteAgentsIndex(
  cwd: string,
  wranglerConfigPath: string,
): Promise<RemoteAgentIndexEntry[]> {
  const provider = resolveProvider();
  const output = await provider
    .getValue({
      cwd,
      configPath: wranglerConfigPath,
      key: "agents:index",
    })
    .catch(() => null);
  if (!output) return [];
  try {
    const parsed = JSON.parse(output) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as RemoteAgentIndexEntry[];
  } catch {
    return [];
  }
}

async function writeRemoteAgentsIndex(
  cwd: string,
  wranglerConfigPath: string,
  entries: RemoteAgentIndexEntry[],
): Promise<void> {
  const path = join(cwd, ".kalp", "agents-index.json");
  await writeFile(path, JSON.stringify(entries, null, 2), "utf-8");
  const provider = resolveProvider();
  try {
    await provider.putManifest({
      cwd,
      configPath: wranglerConfigPath,
      key: "agents:index",
      jsonPath: path,
    });
  } finally {
    await rm(path, { force: true });
  }
}

async function pruneStaleRemoteAgents(params: {
  cwd: string;
  wranglerConfigPath: string;
  remoteEntries: RemoteAgentIndexEntry[];
  localAgentNames: string[];
}): Promise<PruneResult> {
  const { cwd, wranglerConfigPath, remoteEntries, localAgentNames } = params;
  const localSet = new Set(localAgentNames);
  const staleEntries = remoteEntries.filter((entry) => !localSet.has(entry.name));

  if (staleEntries.length === 0) {
    return { removedAgents: [], deletedKeys: 0 };
  }

  const preview = staleEntries.slice(0, 3).map((entry) => entry.name).join(", ");
  const suffix =
    staleEntries.length > 3 ? ` and ${staleEntries.length - 3} more` : "";
  const confirmation = await p.confirm({
    message: `Found ${staleEntries.length} stale remote agents that no longer exist locally (e.g., ${pc.cyan(preview)}${suffix}). Do you want to prune them from the remote runtime?`,
    initialValue: true,
  });

  if (p.isCancel(confirmation)) {
    p.outro("Cancelled");
    process.exit(0);
  }

  if (!confirmation) {
    return { removedAgents: [], deletedKeys: 0 };
  }

  const provider = resolveProvider();
  let deletedKeys = 0;

  for (const entry of staleEntries) {
    const latestKey = `${entry.name}:latest`;
    const latestHash = await provider
      .getValue({ cwd, configPath: wranglerConfigPath, key: latestKey })
      .catch(() => null);

    const hashes = new Set<string>();
    if (entry.hash) hashes.add(entry.hash);
    if (latestHash) hashes.add(latestHash);

    const latestDeleted = await provider
      .deleteValue({
        cwd,
        configPath: wranglerConfigPath,
        key: latestKey,
      })
      .then(() => true)
      .catch(() => false);
    if (latestDeleted) deletedKeys += 1;

    for (const hash of hashes) {
      const deleted = await provider
        .deleteValue({
          cwd,
          configPath: wranglerConfigPath,
          key: `${entry.name}:${hash}`,
        })
        .then(() => true)
        .catch(() => false);
      if (deleted) deletedKeys += 1;
    }
  }

  const filtered = remoteEntries.filter((entry) => localSet.has(entry.name));
  await writeRemoteAgentsIndex(cwd, wranglerConfigPath, filtered);

  return {
    removedAgents: staleEntries.map((entry) => entry.name).sort((a, b) => a.localeCompare(b)),
    deletedKeys,
  };
}

async function mergeRemoteAgentIndexEntry(params: {
  cwd: string;
  wranglerConfigPath: string;
  entry: RemoteAgentIndexEntry;
}): Promise<void> {
  const { cwd, wranglerConfigPath, entry } = params;
  const currentIndex = await readRemoteAgentsIndex(cwd, wranglerConfigPath);
  const merged = [
    ...currentIndex.filter((existing) => existing.name !== entry.name),
    entry,
  ].sort((a, b) => a.name.localeCompare(b.name));

  await writeRemoteAgentsIndex(cwd, wranglerConfigPath, merged);
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

  const provider = resolveProvider();
  try {
    await provider.putManifest({
      cwd,
      configPath: wranglerConfigPath,
      key: manifestKey,
      jsonPath: manifestPath,
    });
    await provider.putValue({
      cwd,
      configPath: wranglerConfigPath,
      key: latestKey,
      value: hash,
    });
  } finally {
    await rm(manifestPath, { force: true });
  }
}

export default defineCommand({
  meta: { name: "push", description: "Publish agent runtime version" },
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
    const isBulkPush = !args.agent;

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
        const target = await promptDeployTarget("No remote runtime detected yet. Where do you want to deploy?");
        if (!target) {
          p.outro("Cancelled");
          return;
        }
        if (target === "kalp-cloud") {
          showKalpCloudWaitlist();
          p.outro(pc.green("Got it — you'll hear from us soon."));
          return;
        }
        p.log.warn("No .kalp/state.json found. Running initial deploy first...");
        const deploy = await runInitialDeploy(cwd);
        state = (await readProjectState(cwd)) ?? createInitialState();
        state.workerUrl = deploy.workerUrl;
        state.accountId = deploy.accountId;
        state.deployedAt = new Date().toISOString();
      }

      runtime = await materializeRuntime(cwd, { mode: "remote" });

      if (isBulkPush) {
        const currentIndex = await readRemoteAgentsIndex(cwd, runtime.wranglerConfigPath);
        const prune = await pruneStaleRemoteAgents({
          cwd,
          wranglerConfigPath: runtime.wranglerConfigPath,
          remoteEntries: currentIndex,
          localAgentNames: availableAgents,
        });

        if (prune.removedAgents.length > 0) {
          p.log.info(
            `Pruned stale remote agents: ${pc.cyan(prune.removedAgents.join(", "))} ${pc.dim(`(${prune.deletedKeys} keys cleaned)`)}`,
          );
        }
      }
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
          spinner.message("Publishing runtime version");
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

          const nextEntry: RemoteAgentIndexEntry = {
            name: agentName,
            hash,
            version: `v${agentState.currentVersion}`,
            versionNumber: agentState.currentVersion,
            updatedAt: agentState.lastPushedAt,
            workerUrl: agentState.workerUrl,
            label: manifest.ir.metadata?.label,
            tags: manifest.ir.metadata?.tags,
          };
          await mergeRemoteAgentIndexEntry({
            cwd,
            wranglerConfigPath: runtime.wranglerConfigPath,
            entry: nextEntry,
          });
        }

        const bundles = manifest.ir.bundles || {};
        await exportCompiledIrForDebug({
          cwd,
          agentName,
          ir: manifest.ir,
        });
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
    if (target === "remote" && result.pushed > 0) {
      p.log.info(
        pc.dim(
          "Changes propagating to remote Studio (eventual consistency, up to ~60s).",
        ),
      );
    }

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
