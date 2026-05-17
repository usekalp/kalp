import { copyFile, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import pc from "picocolors";
import chokidar from "chokidar";
import open from "open";
import { generateTypes } from "@/utils/codegen";
import { ensureSecretKey } from "@/utils/secret";
import { materializeRuntime, readLocalAgentNames } from "@/utils/runtime";
import { EventBus } from "@/runtime/events/event-bus";
import { MetricsCollector } from "@/runtime/metrics/metrics-collector";
import { RuntimeRegistry } from "@/runtime/registry/runtime-registry";
import { MiniflareServer } from "@/runtime/server/miniflare-server";
import { HotReloadCoordinator } from "@/runtime/hot-reload/hot-reload-coordinator";

const LOGO = "🦋";
const STUDIO_ORIGIN = "http://localhost:8787";
const HOT_RELOAD_DEBOUNCE_MS = 450;

function parseDevVars(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (key) result[key] = value;
  }
  return result;
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

    const devVarsForBindings = parseDevVars(devVarsContent);

    const runtime = await materializeRuntime(cwd, {
      mode: "local",
      studioMode: "bundled-artifact",
    });

    const eventBus = new EventBus();
    const metrics = new MetricsCollector();
    const registry = new RuntimeRegistry(eventBus, metrics);
    const mfServer = new MiniflareServer({
      registry,
      scriptPath: runtime.workerEntrypointPath,
      studioDir: runtime.studioDir,
      port: 8787,
      bindings: devVarsForBindings,
    });
    const coordinator = new HotReloadCoordinator({
      registry,
      mfServer,
      cwd,
    });

    p.note("Local environment prepared", "Kalp Dev");

    await mfServer.start();

    const agentNames = await readLocalAgentNames(cwd);
    if (agentNames.length === 0) {
      p.log.warn("No local agents found in ./agents");
    } else {
      const s = p.spinner();
      s.start(`Compiling ${agentNames.length} agent${agentNames.length > 1 ? "s" : ""}...`);
      for (const agentName of agentNames) {
        await coordinator.onFileChange(join(cwd, "agents", agentName, "index.ts"));
      }
      s.stop(`Local agent runtime synced: ${pc.cyan(String(agentNames.length))}`);
    }

    const watcher = chokidar.watch([join(cwd, "agents")], {
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
      ],
    });

    let hotReloadTimer: NodeJS.Timeout | null = null;
    watcher.on("all", (event, changedPath) => {
      p.log.info(pc.dim(`File change detected: ${event} ${changedPath}`));
      if (hotReloadTimer) clearTimeout(hotReloadTimer);
      hotReloadTimer = setTimeout(() => {
        p.log.info(pc.dim("Triggering hot reload..."));
        coordinator.onFileChange(changedPath).catch((err) => {
          p.log.error(`Hot reload failed: ${err instanceof Error ? err.message : String(err)}`);
        });
      }, HOT_RELOAD_DEBOUNCE_MS);
    });

    let shuttingDown = false;
    const shutdown = async (exitAfter = false) => {
      if (shuttingDown) return;
      shuttingDown = true;
      p.log.info(pc.dim("Shutting down..."));
      if (hotReloadTimer) {
        clearTimeout(hotReloadTimer);
        hotReloadTimer = null;
      }
      await watcher.close().catch(() => undefined);
      // Timeout stop to avoid hanging on Miniflare dispose
      await Promise.race([
        mfServer.stop(),
        new Promise(r => setTimeout(r, 3000)),
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

    // Wait indefinitely — shutdown handlers will call process.exit
    await new Promise<void>(() => {});
  },
});
