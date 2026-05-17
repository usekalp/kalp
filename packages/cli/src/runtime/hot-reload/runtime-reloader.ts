import type { ReloadPlan } from "./reload-plan";
import type { RuntimeRegistry } from "../registry/runtime-registry";
import type { MiniflareServer } from "../server/miniflare-server";
import type { HotReloadCoordinator } from "./hot-reload-coordinator";
import type { RuntimePaths } from "@/utils/runtime";
import { materializeRuntime } from "@/utils/runtime";
import { join } from "node:path";
import { readFile } from "node:fs/promises";

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

export interface RuntimeReloaderOptions {
  registry: RuntimeRegistry;
  mfServer: MiniflareServer;
  coordinator: HotReloadCoordinator;
  cwd: string;
  runtimePaths: RuntimePaths;
}

export class RuntimeReloader {
  private registry: RuntimeRegistry;
  private mfServer: MiniflareServer;
  private coordinator: HotReloadCoordinator;
  private cwd: string;
  private runtimePaths: RuntimePaths;

  constructor(options: RuntimeReloaderOptions) {
    this.registry = options.registry;
    this.mfServer = options.mfServer;
    this.coordinator = options.coordinator;
    this.cwd = options.cwd;
    this.runtimePaths = options.runtimePaths;
  }

  async execute(plan: ReloadPlan): Promise<void> {
    for (const [agentName, compiled] of plan.compiledAgents) {
      await this.registry.swapDeployment(agentName, compiled);
      await this.coordinator.mirrorToKV(this.mfServer, agentName, compiled);
    }

    if (plan.rematerialize) {
      this.runtimePaths = await materializeRuntime(this.cwd, {
        mode: "local",
        studioMode: "bundled-artifact",
      });
    }

    if (plan.restartRequired) {
      const devVarsPath = join(this.cwd, ".dev.vars");
      const devVarsContent = await readFile(devVarsPath, "utf-8");
      const bindings = parseDevVars(devVarsContent);

      await this.mfServer.restart({
        scriptPath: this.runtimePaths.workerEntrypointPath,
        bindings,
      });

      // Re-sync ALL agents to new KV (batched — Miniflare KV is in-memory per instance)
      const allAgents = this.registry.getAllAgentNames();
      await Promise.all(
        allAgents.map(async (name) => {
          const deployment = this.registry.getRuntimeDeployment(name);
          if (!deployment) return;
          await this.coordinator.mirrorToKV(this.mfServer, name, deployment.compiled);
        }),
      );
    }
  }

  getRuntimePaths(): RuntimePaths {
    return this.runtimePaths;
  }
}
