import { copyFile, mkdir, readFile, rm, utimes, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { execa } from "execa";
import chokidar from "chokidar";
import open from "open";
import { generateTypes } from "@/utils/codegen";
import { ensureSecretKey } from "@/utils/secret";
import { readAgentManifest, computePushHash } from "@/utils/manifest";
import type { AgentManifestV3 } from "@/utils/manifest";
import { validateCompiledIR } from "@/utils/validate";
import {
  materializeRuntime,
  readLocalAgentNames,
  writeRuntimeAgentsSnapshot,
} from "@/utils/runtime";

const LOGO = "🦋";
const LOCAL_MANIFESTS_DIR = ".kalp/runtime/local-manifests";
const HOT_RELOAD_DEBOUNCE_MS = 450;
const STUDIO_ORIGIN = "http://localhost:8787";

type KvBulkEntry = {
  key: string;
  value: string;
};

type RuntimeAgentIndexEntry = {
  name: string;
  label?: string;
  description?: string;
  tags?: string[];
  environment: "local" | "remote" | "both";
  status: "online" | "offline";
  hash: string | null;
  version: string | null;
  versionNumber: number | null;
  lastRemoteHash: string | null;
  lastLocalHash: string | null;
  workerUrl: string | null;
  localPath: string | null;
  updatedAt: string | null;
};

async function putLocalBulkValues(params: {
  cwd: string;
  configPath: string;
  bulkPath: string;
  persistTo: string;
}): Promise<void> {
  await execa(
    "npx",
    [
      "wrangler",
      "kv",
      "bulk",
      "put",
      params.bulkPath,
      "--binding",
      "KALP_MANIFESTS",
      "--local",
      "--persist-to",
      params.persistTo,
      "--config",
      params.configPath,
    ],
    { cwd: params.cwd },
  );
}

async function syncLocalRuntimeState(params: {
  cwd: string;
  runtimeDir: string;
  configPath: string;
  persistTo: string;
}): Promise<{ synced: number; failed: string[] }> {
  const { cwd, runtimeDir, configPath, persistTo } = params;
  await writeRuntimeAgentsSnapshot({ cwd, runtimeDir, mode: "local" });
  const snapshotPath = join(runtimeDir, "agents.snapshot.json");
  const snapshotRaw = await readFile(snapshotPath, "utf-8").catch(() => "");
  let snapshot: { agents?: Array<Record<string, unknown>> } | null = null;
  if (snapshotRaw) {
    try {
      snapshot = JSON.parse(snapshotRaw) as { agents?: Array<Record<string, unknown>> };
    } catch {
      snapshot = null;
    }
  }

  const manifestDir = join(cwd, LOCAL_MANIFESTS_DIR);
  await mkdir(manifestDir, { recursive: true });

  const agentNames = await readLocalAgentNames(cwd);
  const failed: string[] = [];
  const bulkEntries: KvBulkEntry[] = [];
  const compiledIndexEntries: RuntimeAgentIndexEntry[] = [];
  let synced = 0;

  for (const agentName of agentNames) {
    try {
      const manifest = await readAgentManifest({ cwd, agentName });
      const hash = computePushHash(manifest);
      const validation = validateCompiledIR({ agentName, manifest, hash });
      if (!validation.ok) {
        const details = (validation.errors ?? []).join(" | ");
        throw new Error(
          `validation failed (${validation.phase})${details ? `: ${details}` : ""}`,
        );
      }

      const artifactManifestKey = `${agentName}:${hash}:artifact-manifest`;
      const semanticIrKey = `${agentName}:${hash}:semantic-ir`;
      const schemasKey = `${agentName}:${hash}:schemas`;
      const bundleManifestKey = `${agentName}:${hash}:bundle-manifest`;
      const latestKey = `${agentName}:latest`;
      await writeLocalArtifactFiles({
        manifestDir,
        agentName,
        hash,
        manifest,
      });

      bulkEntries.push(
        { key: artifactManifestKey, value: JSON.stringify(manifest.artifactManifest) },
        { key: semanticIrKey, value: JSON.stringify(manifest.semanticIr) },
        { key: schemasKey, value: JSON.stringify(manifest.schemas) },
        { key: bundleManifestKey, value: JSON.stringify(manifest.bundleManifest) },
      );

      for (const [bundleHash, bundle] of Object.entries(manifest.bundles)) {
        bulkEntries.push({
          key: `${agentName}:${hash}:bundle:${bundleHash}`,
          value: bundle.code,
        });
      }

      compiledIndexEntries.push({
        name: agentName,
        label: manifest.semanticIr.agent?.label ?? agentName,
        description: manifest.semanticIr.agent?.description,
        tags: manifest.semanticIr.agent?.tags ?? [],
        environment: "local",
        status: "online",
        hash,
        version: null,
        versionNumber: null,
        lastRemoteHash: null,
        lastLocalHash: hash,
        workerUrl: `http://localhost:8787/a/${agentName}`,
        localPath: join(cwd, "agents", agentName, "index.ts"),
        updatedAt: new Date().toISOString(),
      });

      bulkEntries.push({ key: latestKey, value: hash });
      synced += 1;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      failed.push(`${agentName}: ${reason}`);
    }
  }

  const syncStatusPath = join(manifestDir, "sync-status.json");
  await writeFile(
    syncStatusPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        totalAgents: agentNames.length,
        synced,
        failed,
      },
      null,
      2,
    ),
    "utf-8",
  );

  if (compiledIndexEntries.length > 0) {
    bulkEntries.push({
      key: "agents:index",
      value: JSON.stringify(compiledIndexEntries),
    });
  } else if (snapshot?.agents && Array.isArray(snapshot.agents)) {
    bulkEntries.push({
      key: "agents:index",
      value: JSON.stringify(snapshot.agents),
    });
  }

  if (bulkEntries.length > 0) {
    const bulkPath = join(manifestDir, "kv-bulk.json");
    await writeFile(bulkPath, JSON.stringify(bulkEntries), "utf-8");
    try {
      await putLocalBulkValues({
        cwd,
        configPath,
        bulkPath,
        persistTo,
      });
    } finally {
      await rm(bulkPath, { force: true });
    }
  }

  if (agentNames.length > 0 && synced === 0 && failed.length > 0) {
    throw new Error(
      `Local sync failed for all agents (${failed.length}): ${failed.slice(0, 3).join(" | ")}`,
    );
  }

  return { synced, failed };
}

async function writeLocalArtifactFiles(params: {
  manifestDir: string;
  agentName: string;
  hash: string;
  manifest: AgentManifestV3;
}): Promise<{
  artifactManifestPath: string;
  semanticIrPath: string;
  schemasPath: string;
  bundleManifestPath: string;
}> {
  const outDir = join(params.manifestDir, `${params.agentName}-${params.hash}`);
  await mkdir(outDir, { recursive: true });
  const bundlesDir = join(outDir, "targets", "default", "bundles");
  await mkdir(bundlesDir, { recursive: true });

  const artifactManifestPath = join(outDir, "artifact-manifest.json");
  const semanticIrPath = join(outDir, "semantic-ir.json");
  const schemasPath = join(outDir, "schemas.json");
  const bundleManifestPath = join(outDir, "bundle-manifest.json");

  await writeFile(
    artifactManifestPath,
    JSON.stringify(params.manifest.artifactManifest),
    "utf-8",
  );
  await writeFile(semanticIrPath, JSON.stringify(params.manifest.semanticIr), "utf-8");
  await writeFile(schemasPath, JSON.stringify(params.manifest.schemas), "utf-8");
  await writeFile(
    bundleManifestPath,
    JSON.stringify(params.manifest.bundleManifest),
    "utf-8",
  );

  for (const [bundleHash, bundle] of Object.entries(params.manifest.bundles)) {
    const bundlePath = join(bundlesDir, `${bundleHash}.js`);
    await writeFile(bundlePath, bundle.code, "utf-8");
  }

  return {
    artifactManifestPath,
    semanticIrPath,
    schemasPath,
    bundleManifestPath,
  };
}

async function terminateProcessTree(processHandle: ReturnType<typeof execa>): Promise<void> {
  if (processHandle.killed) return;
  const pid = processHandle.pid;
  if (!pid) return;

  try {
    processHandle.kill("SIGINT");
  } catch {
    // noop
  }
  await delay(250);
  if (processHandle.killed) return;

  if (process.platform === "win32") {
    try {
      await execa("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
      return;
    } catch {
      // noop
    }
  }

  try {
    processHandle.kill("SIGTERM");
  } catch {
    // noop
  }
  await delay(200);

  if (!processHandle.killed) {
    try {
      processHandle.kill("SIGKILL");
    } catch {
      // noop
    }
  }
}

async function touchFile(filePath: string): Promise<void> {
  const now = new Date();
  await utimes(filePath, now, now).catch(() => undefined);
}

export default defineCommand({
  meta: { name: "dev", description: "Run Worker + Studio local environment" },
  async run() {
    const cwd = process.cwd();

    p.intro(`${LOGO} ${pc.bold("kalp dev")}`);

    await generateTypes(cwd);
    await ensureSecretKey(cwd);
    await copyFile(join(cwd, ".env"), join(cwd, ".dev.vars"));
    const devVarsPath = join(cwd, ".dev.vars");
    const devVarsContent = await readFile(devVarsPath, "utf-8");
    const nextDevVars = devVarsContent
      .replace(/^KALP_ENV=.*$/m, "")
      .replace(/^KALP_RUNTIME_MODE=.*$/m, "")
      .replace(/^KALP_STUDIO_DEV_ORIGIN=.*$/m, "")
      .trimEnd();
    await writeFile(
      devVarsPath,
      `${nextDevVars}\nKALP_ENV=local\nKALP_RUNTIME_MODE=local\n`,
      "utf-8",
    );
    const runtime = await materializeRuntime(cwd, {
      mode: "local",
      studioMode: "bundled-artifact",
    });
    const persistTo = join(runtime.runtimeDir, ".wrangler-state");
    const initialSync = await syncLocalRuntimeState({
      cwd,
      runtimeDir: runtime.runtimeDir,
      configPath: runtime.wranglerConfigPath,
      persistTo,
    });
    if (initialSync.failed.length > 0) {
      for (const failure of initialSync.failed) {
        p.log.warn(`Local sync skipped ${failure}`);
      }
    }
    p.log.info(
      `${pc.dim("Local agent runtime synced:")} ${pc.cyan(String(initialSync.synced))}`,
    );

    p.note("Local environment prepared", "Kalp Dev");

    const backend = execa(
      "npx",
      [
        "wrangler",
        "dev",
        "--port",
        "8787",
        "--local",
        "--persist-to",
        persistTo,
        "--live-reload",
        "--config",
        runtime.wranglerConfigPath,
      ],
      { cwd, stdio: "inherit" },
    );

    let hotReloadTimer: NodeJS.Timeout | null = null;
    let hotReloadRunning = false;
    let hotReloadPending = false;
    let hotReloadRequiresRuntimeRefresh = false;

    const runHotReloadSync = async () => {
      if (hotReloadRunning) {
        hotReloadPending = true;
        return;
      }

      hotReloadRunning = true;
      try {
        if (hotReloadRequiresRuntimeRefresh) {
          await materializeRuntime(cwd, {
            mode: "local",
            studioMode: "bundled-artifact",
          });
          hotReloadRequiresRuntimeRefresh = false;
        }
        const sync = await syncLocalRuntimeState({
          cwd,
          runtimeDir: runtime.runtimeDir,
          configPath: runtime.wranglerConfigPath,
          persistTo,
        });
        await touchFile(runtime.workerEntrypointPath);
        if (sync.failed.length > 0) {
          p.log.warn(
            `Local hot reload synced ${sync.synced} agents with ${sync.failed.length} warnings.`,
          );
          for (const failure of sync.failed) {
            p.log.warn(`Hot reload skipped ${failure}`);
          }
        } else {
          p.log.info(pc.dim(`Local hot reload synced ${sync.synced} agents.`));
        }
      } finally {
        hotReloadRunning = false;
        if (hotReloadPending) {
          hotReloadPending = false;
          void runHotReloadSync();
        }
      }
    };

    const scheduleHotReloadSync = (options?: { refreshRuntime?: boolean }) => {
      if (options?.refreshRuntime) {
        hotReloadRequiresRuntimeRefresh = true;
      }
      if (hotReloadTimer) clearTimeout(hotReloadTimer);
      hotReloadTimer = setTimeout(() => {
        void runHotReloadSync();
      }, HOT_RELOAD_DEBOUNCE_MS);
    };

    const watchRoots = [
      join(cwd, "agents"),
      join(cwd, ".kalp", "state.json"),
      join(cwd, "packages", "cli", "runtime-template"),
    ];
    const watcher = chokidar.watch(watchRoots, {
      ignoreInitial: true,
      persistent: true,
      usePolling: false,
      awaitWriteFinish: {
        stabilityThreshold: 150,
        pollInterval: 20,
      },
      ignored: [
        /(^|[\\/])\.git([\\/]|$)/,
        /(^|[\\/])node_modules([\\/]|$)/,
        /(^|[\\/])\.kalp[\\/]runtime[\\/]local-manifests([\\/]|$)/,
      ],
    });
    watcher.on("all", (_event, changedPath) => {
      const refreshRuntime = changedPath.includes(
        `${join("packages", "cli", "runtime-template")}`,
      );
      scheduleHotReloadSync({ refreshRuntime });
    });

    let shuttingDown = false;
    const shutdown = async (exitAfter = false) => {
      if (shuttingDown) return;
      shuttingDown = true;
      if (hotReloadTimer) {
        clearTimeout(hotReloadTimer);
        hotReloadTimer = null;
      }
      await watcher.close().catch(() => undefined);
      await Promise.allSettled([
        terminateProcessTree(backend),
      ]);
      if (exitAfter) process.exit(130);
    };

    const onSigInt = () => void shutdown(true);
    const onSigTerm = () => void shutdown(true);
    process.once("SIGINT", onSigInt);
    process.once("SIGTERM", onSigTerm);

    const bootSpinner = p.spinner();
    bootSpinner.start("Starting development server...");
    await delay(1800);
    bootSpinner.stop("Development server is running at http://localhost:8787");
    const studioUrl = `${STUDIO_ORIGIN}/studio/login`;
    await open(studioUrl);
    p.log.success(`Studio available at ${pc.cyan(studioUrl)}`);

    try {
      await backend;
    } finally {
      await shutdown(false);
      process.off("SIGINT", onSigInt);
      process.off("SIGTERM", onSigTerm);
    }
  },
});
