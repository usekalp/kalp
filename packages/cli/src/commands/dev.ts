import { watch, type FSWatcher } from "node:fs";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { execa } from "execa";
import open from "open";
import { generateTypes } from "@/utils/codegen";
import { ensureSecretKey } from "@/utils/secret";
import { readAgentManifest, computePushHash } from "@/utils/manifest";
import { validateCompiledIR } from "@/utils/validate";
import {
  materializeRuntime,
  readLocalAgentNames,
  writeRuntimeAgentsSnapshot,
} from "@/utils/runtime";

const LOGO = "🦋";
const LOCAL_MANIFESTS_DIR = ".kalp/runtime/local-manifests";
const HOT_RELOAD_DEBOUNCE_MS = 450;

async function putLocalManifest(params: {
  cwd: string;
  configPath: string;
  key: string;
  manifestPath: string;
}): Promise<void> {
  await execa(
    "npx",
    [
      "wrangler",
      "kv",
      "key",
      "put",
      params.key,
      "--path",
      params.manifestPath,
      "--binding",
      "KALP_MANIFESTS",
      "--local",
      "--config",
      params.configPath,
    ],
    { cwd: params.cwd },
  );
}

async function putLocalValue(params: {
  cwd: string;
  configPath: string;
  key: string;
  value: string;
}): Promise<void> {
  await execa(
    "npx",
    [
      "wrangler",
      "kv",
      "key",
      "put",
      params.key,
      params.value,
      "--binding",
      "KALP_MANIFESTS",
      "--local",
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
}): Promise<{ synced: number; failed: string[] }> {
  const { cwd, runtimeDir, configPath } = params;
  await writeRuntimeAgentsSnapshot({ cwd, runtimeDir, mode: "local" });

  const manifestDir = join(cwd, LOCAL_MANIFESTS_DIR);
  await rm(manifestDir, { recursive: true, force: true });
  await mkdir(manifestDir, { recursive: true });

  const agentNames = await readLocalAgentNames(cwd);
  const failed: string[] = [];
  let synced = 0;

  for (const agentName of agentNames) {
    try {
      const manifest = await readAgentManifest({ cwd, agentName });
      const hash = computePushHash(manifest.ir);
      const validation = validateCompiledIR({ agentName, ir: manifest.ir, hash });
      if (!validation.ok) {
        const details = (validation.errors ?? []).join(" | ");
        throw new Error(
          `validation failed (${validation.phase})${details ? `: ${details}` : ""}`,
        );
      }

      const manifestKey = `${agentName}:${hash}`;
      const latestKey = `${agentName}:latest`;
      const manifestPath = join(manifestDir, `${agentName}-${hash}.json`);
      await writeFile(manifestPath, JSON.stringify(manifest.ir), "utf-8");

      await putLocalManifest({
        cwd,
        configPath,
        key: manifestKey,
        manifestPath,
      });
      await putLocalValue({
        cwd,
        configPath,
        key: latestKey,
        value: hash,
      });
      synced += 1;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      failed.push(`${agentName}: ${reason}`);
    }
  }

  return { synced, failed };
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
      .trimEnd();
    await writeFile(
      devVarsPath,
      `${nextDevVars}\nKALP_ENV=local\nKALP_RUNTIME_MODE=local\n`,
      "utf-8",
    );
    const runtime = await materializeRuntime(cwd, { mode: "local" });
    const initialSync = await syncLocalRuntimeState({
      cwd,
      runtimeDir: runtime.runtimeDir,
      configPath: runtime.wranglerConfigPath,
    });
    if (initialSync.failed.length > 0) {
      for (const failure of initialSync.failed) {
        p.log.warn(`Local sync skipped ${failure}`);
      }
    }
    p.log.info(
      `${pc.dim("Local agent runtime synced:")} ${pc.cyan(String(initialSync.synced))}`,
    );

    p.note("Starting local runtime (wrangler dev :8787)");

    const backend = execa(
      "npx",
      [
        "wrangler",
        "dev",
        "--port",
        "8787",
        "--local",
        "--config",
        runtime.wranglerConfigPath,
      ],
      { cwd, stdio: "inherit" },
    );

    let hotReloadTimer: NodeJS.Timeout | null = null;
    let hotReloadRunning = false;
    let hotReloadPending = false;

    const runHotReloadSync = async () => {
      if (hotReloadRunning) {
        hotReloadPending = true;
        return;
      }

      hotReloadRunning = true;
      try {
        const sync = await syncLocalRuntimeState({
          cwd,
          runtimeDir: runtime.runtimeDir,
          configPath: runtime.wranglerConfigPath,
        });
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

    const scheduleHotReloadSync = () => {
      if (hotReloadTimer) clearTimeout(hotReloadTimer);
      hotReloadTimer = setTimeout(() => {
        void runHotReloadSync();
      }, HOT_RELOAD_DEBOUNCE_MS);
    };

    const watchers: FSWatcher[] = [];
    const watchTargets = [join(cwd, "agents"), join(cwd, ".kalp", "state.json")];
    for (const target of watchTargets) {
      try {
        const watcher = watch(
          target,
          target.endsWith(".json") ? undefined : { recursive: true },
          () => scheduleHotReloadSync(),
        );
        watchers.push(watcher);
      } catch {
        // Ignore missing targets (e.g. no agents yet)
      }
    }

    const shutdown = () => {
      if (hotReloadTimer) {
        clearTimeout(hotReloadTimer);
        hotReloadTimer = null;
      }
      for (const watcher of watchers) {
        watcher.close();
      }
      backend.kill("SIGINT");
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

    await delay(2500);
    const studioUrl = "http://localhost:8787/studio/login";
    await open(studioUrl);
    p.log.success(`Studio opened at ${pc.cyan(studioUrl)}`);

    try {
      await backend;
    } finally {
      shutdown();
      process.off("SIGINT", shutdown);
      process.off("SIGTERM", shutdown);
    }
  },
});
