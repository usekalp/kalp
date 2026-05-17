import { readAgentManifest, computePushHash } from "@/utils/manifest";
import { validateCompiledIR } from "@/utils/validate";
import type { RuntimeRegistry } from "../registry/runtime-registry";
import type { MiniflareServer } from "../server/miniflare-server";
import type { CompiledDeployment } from "../deployment/types";
import { detectChangeType, type ChangeType } from "./change-detector";
import { resolveAffectedAgents } from "./affected-agents";
import { hashJson } from "../utils/hashing";

export interface HotReloadOptions {
  registry: RuntimeRegistry;
  mfServer: MiniflareServer;
  cwd: string;
}

export class HotReloadCoordinator {
  private registry: RuntimeRegistry;
  private mfServer: MiniflareServer;
  private cwd: string;
  private previousDeployments: Map<string, CompiledDeployment>;

  constructor(options: HotReloadOptions) {
    this.registry = options.registry;
    this.mfServer = options.mfServer;
    this.cwd = options.cwd;
    this.previousDeployments = new Map();
  }

  async onFileChange(changedPath: string): Promise<void> {
    const endReload = this.registry.metricsRef.startReload();
    const affectedAgents = await resolveAffectedAgents(changedPath, this.cwd);
    let needsRestart = false;

    for (const agentName of affectedAgents) {
      const endCompile = this.registry.metricsRef.startCompile();
      const compiled = await this.compileAgentToDeployment(agentName);
      endCompile();

      const previous = this.previousDeployments.get(agentName);
      const changeType = previous ? detectChangeType(previous, compiled) : "code";

      if (previous) {
        console.error(`[hot-reload] ${agentName}: runtimeHash changed=${previous.runtimeHash !== compiled.runtimeHash}, bundleHash changed=${previous.bundleHash !== compiled.bundleHash}, changeType=${changeType}`);
      } else {
        console.error(`[hot-reload] ${agentName}: first compile, changeType=${changeType}`);
      }

      await this.registry.swapDeployment(agentName, compiled);
      this.previousDeployments.set(agentName, compiled);

      if (changeType === "code") {
        needsRestart = true;
      }

      const kv = await this.mfServer.getKVNamespace();
      await this.mirrorDeploymentToKV(kv, agentName, compiled);
      console.error(`[hot-reload] ${agentName}: mirrored to KV with hash=${compiled.hash.slice(0, 8)}..., label=${compiled.semanticIr.agent?.label}`);

      this.registry.eventBusRef.emit({
        type: "agent_updated",
        agentName,
        deploymentHash: compiled.hash,
        generation: compiled.generation,
        changeType,
        timestamp: new Date().toISOString(),
      });
    }

    if (needsRestart) {
      console.error(`[hot-reload] restarting miniflare...`);
      this.registry.metricsRef.recordFullRestart();
      await this.mfServer.restart();
      console.error(`[hot-reload] miniflare restarted`);
    } else {
      this.registry.metricsRef.recordHotSwap();
    }

    endReload();
  }

  private async compileAgentToDeployment(agentName: string): Promise<CompiledDeployment> {
    const manifest = await readAgentManifest({ cwd: this.cwd, agentName });
    const hash = computePushHash(manifest);
    const validation = validateCompiledIR({ agentName, manifest, hash });
    if (!validation.ok) {
      const details = (validation.errors ?? []).join(" | ");
      throw new Error(`validation failed (${validation.phase})${details ? `: ${details}` : ""}`);
    }

    return {
      hash,
      generation: 0,
      metadataHash: hashJson({
        label: manifest.semanticIr.agent?.label,
        description: manifest.semanticIr.agent?.description,
        tags: manifest.semanticIr.agent?.tags,
        systemPrompt: manifest.semanticIr.agent?.systemPrompt,
      }),
      runtimeHash: hashJson({
        nodes: manifest.semanticIr.nodes,
        requirements: manifest.semanticIr.requirements,
      }),
      bundleHash: hashJson(manifest.bundleManifest),
      semanticHash: manifest.artifactManifest.semanticHash,
      semanticIr: manifest.semanticIr,
      schemas: manifest.schemas,
      artifactManifest: manifest.artifactManifest,
      bundleManifest: manifest.bundleManifest,
      bundleFiles: manifest.bundles,
      routingTable: this.buildRoutingTable(manifest),
      capabilities: this.buildCapabilities(manifest),
      compiledAt: new Date().toISOString(),
    };
  }

  private buildRoutingTable(manifest: Awaited<ReturnType<typeof readAgentManifest>>): CompiledDeployment["routingTable"] {
    return Object.values(manifest.semanticIr.nodes)
      .filter(n => n.kind === "route" || n.kind === "contract" || n.kind === "listener" || n.kind === "cron")
      .map(node => ({
        id: node.id,
        stableName: node.stableName,
        method: (node as any).http?.method ?? (node as any).trigger?.method ?? "GET",
        path: (node as any).http?.path ?? (node as any).trigger?.path ?? "/",
        nodeId: node.id,
        kind: node.kind === "cron" ? "hook" as const : node.kind as CompiledDeployment["routingTable"][number]["kind"],
      }));
  }

  private buildCapabilities(manifest: Awaited<ReturnType<typeof readAgentManifest>>): CompiledDeployment["capabilities"] {
    const nodes = Object.values(manifest.semanticIr.nodes);
    return {
      hasMessage: nodes.some(n => n.kind === "message"),
      hasState: Boolean(manifest.semanticIr.requirements?.hasState),
      hasListeners: nodes.some(n => n.kind === "listener"),
      routeCount: nodes.filter(n => n.kind === "route").length,
      contractCount: nodes.filter(n => n.kind === "contract").length,
    };
  }

  private async mirrorDeploymentToKV(
    kv: Awaited<ReturnType<typeof import("miniflare").Miniflare.prototype.getKVNamespace>>,
    agentName: string,
    compiled: CompiledDeployment,
  ): Promise<void> {
    const values: Array<{ key: string; value: string }> = [
      { key: `${agentName}:${compiled.hash}:artifact-manifest`, value: JSON.stringify(compiled.artifactManifest) },
      { key: `${agentName}:${compiled.hash}:semantic-ir`, value: JSON.stringify(compiled.semanticIr) },
      { key: `${agentName}:${compiled.hash}:schemas`, value: JSON.stringify(compiled.schemas) },
      { key: `${agentName}:${compiled.hash}:bundle-manifest`, value: JSON.stringify(compiled.bundleManifest) },
    ];

    for (const [bundleHash, bundle] of Object.entries(compiled.bundleFiles)) {
      values.push({ key: `${agentName}:${compiled.hash}:bundle:${bundleHash}`, value: bundle.code });
    }
    values.push({ key: `${agentName}:latest`, value: compiled.hash });

    for (const item of values) {
      await kv.put(item.key, item.value);
    }
  }
}
