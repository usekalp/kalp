import type { RestartReason, RuntimeFileEvent } from "./types";
import { RuntimeLifecycle } from "./lifecycle/runtime-lifecycle";
import { RuntimeShutdown } from "./lifecycle/runtime-shutdown";
import { RuntimeWatcher } from "./watcher/runtime-watcher";
import { HotReloadCoordinator } from "./hot-reload/hot-reload-coordinator";
import { RuntimeReloader } from "./hot-reload/runtime-reloader";
import { classifyChange } from "./hot-reload/change-classifier";
import { MiniflareServer } from "./server/miniflare-server";
import { RuntimeRegistry } from "./registry/runtime-registry";
import { EventBus } from "./events/event-bus";
import { MetricsCollector } from "./metrics/metrics-collector";
import { materializeRuntime, readLocalAgentNames } from "@/utils/runtime";
import { generateTypes } from "@/utils/codegen";
import { ensureSecretKey } from "@/utils/secret";
import { AsyncLock } from "./utils/async-lock";
import { join } from "node:path";
import { readFile, writeFile, copyFile } from "node:fs/promises";
import { RestartTimeoutError } from "./errors";
import pc from "picocolors";

const RESTART_TIMEOUT_MS = 15_000;

export interface RuntimeUI {
  note(message: string, title?: string): void;
  startSpinner(text: string): { stop(text: string): void };
  logInfo(text: string): void;
  logError(text: string): void;
  logSuccess(text: string): void;
}

export interface CreateRuntimeOptions {
  cwd: string;
  port?: number;
  ui?: RuntimeUI;
}

export interface RuntimeInstance {
  start(): Promise<void>;
  startWatcher(): Promise<void>;
  stop(): Promise<void>;
  restart(reason: RestartReason): Promise<void>;
  waitForShutdown(): Promise<void>;
  startDev(): Promise<void>;
}

export async function createRuntime(options: CreateRuntimeOptions): Promise<RuntimeInstance> {
  const cwd = options.cwd;
  const port = options.port ?? 8787;
  const ui = options.ui;

  const lifecycle = new RuntimeLifecycle();
  const pendingReloads = new Set<string>();
  const restartLock = new AsyncLock();
  let acceptingReloads = true;
  let debounceTimer: NodeJS.Timeout | null = null;
  let runtimePaths: Awaited<ReturnType<typeof materializeRuntime>> | null = null;

  let registry: RuntimeRegistry;
  let mfServer: MiniflareServer;
  let coordinator: HotReloadCoordinator;
  let reloader: RuntimeReloader;
  let watcher: RuntimeWatcher | null = null;

  let shutdownResolve: () => void;
  const shutdownPromise = new Promise<void>((resolve) => {
    shutdownResolve = resolve;
  });

  const shutdown = new RuntimeShutdown(() => void instance.stop());

  const instance: RuntimeInstance = {
    async start() {
      lifecycle.transition("starting");

      ui?.logInfo("Generating types...");
      await generateTypes(cwd);
      await ensureSecretKey(cwd);

      const envPath = join(cwd, ".env");
      const devVarsPath = join(cwd, ".dev.vars");
      await copyFile(envPath, devVarsPath);
      const devVarsContent = await readFile(devVarsPath, "utf-8");
      const normalizedDevVars = devVarsContent
        .replace(/^KALP_ENV=.*$/m, "")
        .replace(/^KALP_RUNTIME_MODE=.*$/m, "")
        .replace(/^KALP_STUDIO_DEV_ORIGIN=.*$/m, "")
        .trimEnd();
      await writeFile(devVarsPath, `${normalizedDevVars}\nKALP_ENV=local\nKALP_RUNTIME_MODE=local\n`, "utf-8");

      runtimePaths = await materializeRuntime(cwd, { mode: "local", studioMode: "bundled-artifact" });

      const devVarsForBindings = parseDevVars(await readFile(devVarsPath, "utf-8"));

      const eventBus = new EventBus();
      const metrics = new MetricsCollector();
      registry = new RuntimeRegistry(eventBus, metrics);

      mfServer = new MiniflareServer({
        registry,
        scriptPath: runtimePaths.workerEntrypointPath,
        studioDir: runtimePaths.studioDir,
        port,
        bindings: devVarsForBindings,
      });

      coordinator = new HotReloadCoordinator({ registry, mfServer, cwd });
      reloader = new RuntimeReloader({ registry, mfServer, coordinator, cwd, runtimePaths });

      await mfServer.start();

      const agentNames = await readLocalAgentNames(cwd);
      if (agentNames.length > 0) {
        const spinner = ui?.startSpinner(`Compiling ${agentNames.length} agent${agentNames.length > 1 ? "s" : ""}...`);
        for (const agentName of agentNames) {
          await coordinator.onFileChange(join(cwd, "agents", agentName, "index.ts"));
        }
        spinner?.stop(`Local agent runtime synced: ${pc.cyan(String(agentNames.length))}`);
      }

      lifecycle.transition("running");

      shutdown.installSignalHandlers();
      shutdown.register(async () => {
        await watcher?.close().catch(() => undefined);
      });
    },

    async startWatcher() {
      if (!runtimePaths) throw new Error("Runtime not started");

      const runtimeTemplateDir = join(runtimePaths.runtimeDir, "..", "..", "runtime-template");

      watcher = new RuntimeWatcher({
        paths: [
          join(cwd, "agents"),
          join(cwd, ".env"),
          join(cwd, ".dev.vars"),
          join(runtimeTemplateDir, "**/*"),
        ],
        ignored: [
          /(^|[\\/])\.kalp([\\/]|$)/,
          /(^|[\\/])node_modules([\\/]|$)/,
          /(^|[\\/])\.git([\\/]|$)/,
          /kalp-build-/,
          /kalp-modules/,
        ],
        onEvent: (events) => void handleFileEvents(events),
      });

      watcher.start();
    },

    async stop() {
      if (lifecycle.getState() === "stopped") return;

      lifecycle.transition("stopping");
      acceptingReloads = false;

      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }

      await shutdown.dispose();
      await mfServer.stop();

      lifecycle.transition("stopped");
      shutdownResolve();
    },

    async restart(_reason: RestartReason) {
      lifecycle.assertState("running", "restarting");

      if (lifecycle.getState() === "restarting") {
        return;
      }

      await executeReload([]);
    },

    async waitForShutdown() {
      await shutdownPromise;
    },

    async startDev() {
      await this.start();
      await this.startWatcher();
      await this.waitForShutdown();
    },
  };

  async function handleFileEvents(events: RuntimeFileEvent[]) {
    if (!acceptingReloads) {
      for (const event of events) pendingReloads.add(event.path);
      return;
    }

    void enqueueReload(events.map((e) => e.path));
  }

  async function enqueueReload(paths: string[]) {
    for (const path of paths) pendingReloads.add(path);

    await restartLock.acquire("global", async () => {
      if (!acceptingReloads) return;

      const reloadPaths = Array.from(pendingReloads);
      pendingReloads.clear();

      if (!runtimePaths) return;

      const classifications = reloadPaths.map((p) => classifyChange(p, runtimePaths!, cwd));
      const needsRestart = classifications.some((c) => c.restartReason !== null);

      if (needsRestart) {
        await executeReload(reloadPaths);
      } else {
        ui?.logInfo(pc.dim("Metadata change detected, swapping deployments..."));
        for (const path of reloadPaths) {
          await coordinator.onFileChange(path);
        }
        ui?.logSuccess(pc.dim("Hot swap complete"));
      }
    });
  }

  async function executeReload(initialPaths: string[]) {
    for (const p of initialPaths) pendingReloads.add(p);

    await Promise.race([
      doExecuteReload(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new RestartTimeoutError(RESTART_TIMEOUT_MS)), RESTART_TIMEOUT_MS),
      ),
    ]).catch((err) => {
      if (lifecycle.getState() === "restarting") {
        lifecycle.transition("running");
      }
      acceptingReloads = true;
      throw err;
    });
  }

  async function doExecuteReload() {
    lifecycle.transition("restarting");
    acceptingReloads = false;

    try {
      const pendingPaths = Array.from(pendingReloads);
      pendingReloads.clear();

      if (!runtimePaths) return;

      const classifications = pendingPaths.map((p) => classifyChange(p, runtimePaths!, cwd));
      const reasons = new Set(classifications.map((c) => c.restartReason).filter(Boolean) as RestartReason[]);
      ui?.logInfo(pc.dim(`Hot reload triggered (${[...reasons].join(", ") || "unknown"})...`));

      const plan = await coordinator.prepareReloadPlan(pendingPaths, runtimePaths);

      const agentNames = Array.from(plan.compiledAgents.keys());
      if (agentNames.length > 0) {
        ui?.logInfo(pc.dim(`  → Recompiled: ${agentNames.join(", ")}`));
      }
      if (plan.rematerialize) {
        ui?.logInfo(pc.dim("  → Runtime template changed, rematerializing..."));
      }
      if (plan.restartRequired) {
        ui?.logInfo(pc.dim(`  → Restarting server (${plan.restartReason})...`));
      }

      await reloader.execute(plan);

      ui?.logSuccess(pc.dim("Hot reload complete"));
    } finally {
      if (lifecycle.getState() === "restarting") {
        acceptingReloads = true;
        lifecycle.transition("running");
      }
    }
  }

  return instance;
}

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
