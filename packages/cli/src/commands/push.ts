import { access, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { ensureConfig } from "@/utils/fs";
import { generateTypes } from "@/utils/codegen";
import { readAgentManifest, computePushHash } from "@/utils/manifest";
import type { AgentManifestV3 } from "@/utils/manifest";
import { requireAuth } from "@/utils/auth";
import { runInitialDeploy, ensureKvNamespaceBindingId } from "@/utils/deploy";
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
import { showKalpCloudWaitlist } from "@/utils/deploy-target";
import { loadProjectConfig } from "@/utils/project-config";
import {
  collectMcpSecretRequirements,
  type KalpProjectConfig,
} from "@kalphq/sdk";

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
    workerUrl: state.workerUrl
      ? `${state.workerUrl.replace(/\/$/, "")}/a/${agentName}`
      : null,
  };
  state.agents[agentName] = created;
  return created;
}

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
  const staleEntries = remoteEntries.filter(
    (entry) => !localSet.has(entry.name),
  );

  if (staleEntries.length === 0) {
    return { removedAgents: [], deletedKeys: 0 };
  }

  const preview = staleEntries
    .slice(0, 3)
    .map((entry) => entry.name)
    .join(", ");
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
      const artifactKeys = await provider
        .listKeys({
          cwd,
          configPath: wranglerConfigPath,
          prefix: `${entry.name}:${hash}:`,
        })
        .catch(() => []);

      for (const artifactKey of artifactKeys) {
        const deleted = await provider
          .deleteValue({
            cwd,
            configPath: wranglerConfigPath,
            key: artifactKey.name,
          })
          .then(() => true)
          .catch(() => false);
        if (deleted) deletedKeys += 1;
      }
    }
  }

  const filtered = remoteEntries.filter((entry) => localSet.has(entry.name));
  await writeRemoteAgentsIndex(cwd, wranglerConfigPath, filtered);

  return {
    removedAgents: staleEntries
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b)),
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
  manifest: AgentManifestV3;
}): Promise<void> {
  const { cwd, wranglerConfigPath, agentName, hash, manifest } = params;
  const latestKey = `${agentName}:latest`;
  const artifactsDir = join(cwd, ".kalp", `${agentName}-${hash}-artifacts`);
  await mkdir(artifactsDir, { recursive: true });

  const artifactManifestPath = join(artifactsDir, "artifact-manifest.json");
  const semanticIrPath = join(artifactsDir, "semantic-ir.json");
  const schemasPath = join(artifactsDir, "schemas.json");
  const bundleManifestPath = join(artifactsDir, "bundle-manifest.json");

  await writeFile(
    artifactManifestPath,
    JSON.stringify(manifest.artifactManifest),
    "utf-8",
  );
  await writeFile(semanticIrPath, JSON.stringify(manifest.semanticIr), "utf-8");
  await writeFile(schemasPath, JSON.stringify(manifest.schemas), "utf-8");
  await writeFile(
    bundleManifestPath,
    JSON.stringify(manifest.bundleManifest),
    "utf-8",
  );

  const provider = resolveProvider();
  try {
    await provider.putManifest({
      cwd,
      configPath: wranglerConfigPath,
      key: `${agentName}:${hash}:artifact-manifest`,
      jsonPath: artifactManifestPath,
    });
    await provider.putManifest({
      cwd,
      configPath: wranglerConfigPath,
      key: `${agentName}:${hash}:semantic-ir`,
      jsonPath: semanticIrPath,
    });
    await provider.putManifest({
      cwd,
      configPath: wranglerConfigPath,
      key: `${agentName}:${hash}:schemas`,
      jsonPath: schemasPath,
    });
    await provider.putManifest({
      cwd,
      configPath: wranglerConfigPath,
      key: `${agentName}:${hash}:bundle-manifest`,
      jsonPath: bundleManifestPath,
    });

    for (const [bundleHash, bundle] of Object.entries(manifest.bundles)) {
      await provider.putValue({
        cwd,
        configPath: wranglerConfigPath,
        key: `${agentName}:${hash}:bundle:${bundleHash}`,
        value: bundle.code,
      });
    }

    await provider.putValue({
      cwd,
      configPath: wranglerConfigPath,
      key: latestKey,
      value: hash,
    });
  } finally {
    await rm(artifactsDir, { recursive: true, force: true });
  }
}

export default defineCommand({
  meta: { name: "push", description: "Upload agents to remote runtime" },
  args: {
    agent: {
      type: "string",
      alias: "a",
      description: "Agent name to push",
      required: false,
    },
    strictSecrets: {
      type: "boolean",
      description:
        "Fail if required MCP secrets are missing from remote runtime",
      required: false,
      default: false,
    },
  },
  async run({ args }) {
    const cwd = process.cwd();
    const isBulkPush = !args.agent;

    p.intro(`${LOGO} ${pc.bold("kalp push")}`);

    await ensureConfig(cwd).catch(() => {
      p.log.error(`${pc.cyan("kalp.config.ts")} not found`);
      process.exit(1);
    });
    await generateTypes(cwd);

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
    let runtime = await materializeRuntime(cwd);

    await requireAuth().catch(() => {
      p.log.error("Not authenticated. Run `kalp login` first.");
      process.exit(1);
    });

    if (!state.workerUrl) {
      const deployTarget = await p.select({
        message: "No remote runtime detected yet. Where do you want to deploy?",
        options: [
          { value: "cloudflare", label: "☁️ Cloudflare (your account)" },
          { value: "kalp-cloud", label: "🦋 Kalp Cloud (managed)" },
        ],
      });

      if (p.isCancel(deployTarget) || !deployTarget) {
        p.outro("Cancelled");
        return;
      }
      if (deployTarget === "kalp-cloud") {
        showKalpCloudWaitlist();
        p.outro(pc.green("Got it — you'll hear from us soon."));
        return;
      }
      const s = p.spinner();
      s.start("Running initial deploy");
      const deploy = await runInitialDeploy(cwd);
      s.stop("Initial deploy completed");
      state = (await readProjectState(cwd)) ?? createInitialState();
      state.workerUrl = deploy.workerUrl;
      state.accountId = deploy.accountId;
      state.deployedAt = new Date().toISOString();
    }

    runtime = await materializeRuntime(cwd);

    // Ensure KV namespace has an ID before pushing
    const kvId = await ensureKvNamespaceBindingId(cwd, runtime.wranglerConfigPath);
    if (!kvId) {
      p.log.error(
        `Could not resolve KV namespace ID for KALP_MANIFESTS. Run \`npx wrangler kv namespace create ${runtime.workerName}-kalp-manifests\` manually.`,
      );
      process.exit(1);
    }

    // Validate MCP Secrets
    const { raw: config } = await loadProjectConfig(cwd);
    const requiredMcpSecrets = collectMcpSecretRequirements(
      config as unknown as KalpProjectConfig,
    );
    if (requiredMcpSecrets.length > 0) {
      const provider = resolveProvider();
      const remoteSecrets = await provider
        .listSecrets({ cwd, configPath: runtime.wranglerConfigPath })
        .catch(() => []);
      const remoteSecretNames = new Set(remoteSecrets.map((s) => s.name));
      const missing = requiredMcpSecrets.filter(
        (s) => !remoteSecretNames.has(s),
      );

      if (missing.length > 0) {
        p.log.warn(
          `${pc.yellow("⚠️  Missing MCP secrets detected in remote runtime:")}\n` +
            missing.map((m) => `   - ${pc.bold(m)}`).join("\n"),
        );
        if (args.strictSecrets) {
          p.log.error(
            pc.red(
              "Push aborted due to missing required secrets (--strict-secrets is enabled).",
            ),
          );
          process.exit(1);
        }
        p.log.info(
          pc.dim(
            "Deployment will continue. You can add them later with `kalp secrets add`.",
          ),
        );
      }
    }

    if (isBulkPush) {
      const currentIndex = await readRemoteAgentsIndex(
        cwd,
        runtime.wranglerConfigPath,
      );
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
        const hash = computePushHash(manifest);
        const validation = validateCompiledIR({
          agentName,
          manifest,
          hash,
        });
        if (!validation.ok) {
          const details = (validation.errors ?? []).join(" | ");
          throw new Error(
            `validation failed (${validation.phase})${details ? `: ${details}` : ""}`,
          );
        }

        const agentState = ensureAgentState(state, agentName, agentPath);
        const previousHash = agentState.lastRemoteHash;

        if (previousHash === hash) {
          result.skipped += 1;
          spinner.stop(`Skipped ${pc.cyan(agentName)} (no changes)`);
          continue;
        }

        spinner.message(
          `Uploading agent ${pc.cyan(agentName)} to remote runtime`,
        );
        await pushRemoteManifest({
          cwd,
          wranglerConfigPath: runtime.wranglerConfigPath,
          agentName,
          hash,
          manifest,
        });

        agentState.currentVersion = Math.max(0, agentState.currentVersion) + 1;
        agentState.currentHash = hash;
        agentState.lastPushedAt = new Date().toISOString();
        agentState.workerUrl =
          state.workerUrl
            ? `${state.workerUrl.replace(/\/$/, "")}/a/${agentName}`
            : agentState.workerUrl;

        agentState.lastRemoteHash = hash;
        agentState.lastLocalHash = hash;

        const nextEntry: RemoteAgentIndexEntry = {
          name: agentName,
          hash,
          version: `v${agentState.currentVersion}`,
          versionNumber: agentState.currentVersion,
          updatedAt: agentState.lastPushedAt,
          workerUrl: agentState.workerUrl,
          label: manifest.semanticIr.agent?.label,
          tags: manifest.semanticIr.agent?.tags,
        };
        await mergeRemoteAgentIndexEntry({
          cwd,
          wranglerConfigPath: runtime.wranglerConfigPath,
          entry: nextEntry,
        });

        await exportCompiledIrForDebug({
          cwd,
          agentName,
          manifest,
        });
        const totalSize = Object.values(manifest.bundles).reduce(
          (sum, bundle) => sum + Buffer.byteLength(bundle.code),
          0,
        );
        const handlerCount = Object.keys(manifest.bundles).length;
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
    await materializeRuntime(cwd);

    p.note(
      `Successfully pushed ${result.pushed} agents. ${result.skipped} omitted (no changes). ${result.failed} failed.`,
      "Remote push",
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
