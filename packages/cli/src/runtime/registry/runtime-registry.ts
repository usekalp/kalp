import type { CompiledDeployment } from "../deployment/types";
import { ModuleLoader } from "../loader/module-loader";
import { NodeIndex } from "./node-index";
import { ExecutionPinning } from "./execution-pinning";
import { DeploymentHistoryManager } from "./deployment-history";
import { AsyncLock } from "../utils/async-lock";
import { MetricsCollector } from "../metrics/metrics-collector";
import type { EventBus } from "../events/event-bus";
import type { RuntimeDeployment, RuntimeAgent } from "./types";
import type { LoadedModule } from "../loader/types";

export class RuntimeRegistry {
  private agents = new Map<string, RuntimeAgent>();
  private nodeIndex: NodeIndex;
  private executionPinning: ExecutionPinning;
  private deploymentHistory: DeploymentHistoryManager;
  private lock: AsyncLock;
  private metrics: MetricsCollector;
  private eventBus: EventBus;
  private nextGeneration = 0;

  constructor(eventBus: EventBus, metrics: MetricsCollector) {
    this.eventBus = eventBus;
    this.metrics = metrics;
    this.nodeIndex = new NodeIndex();
    this.executionPinning = new ExecutionPinning();
    this.deploymentHistory = new DeploymentHistoryManager();
    this.lock = new AsyncLock();
  }

  async swapDeployment(name: string, compiled: CompiledDeployment): Promise<void> {
    await this.lock.acquire(name, async () => {
      const generation = ++this.nextGeneration;

      const moduleLoaders = new Map<string, () => Promise<LoadedModule>>();
      for (const [nodeId, bundleFile] of Object.entries(compiled.bundleFiles)) {
        moduleLoaders.set(nodeId, () => ModuleLoader.load(nodeId, bundleFile.code));
      }

      const deployment: RuntimeDeployment = {
        compiled: { ...compiled, generation },
        moduleLoaders,
        moduleCache: new Map(),
        generation,
        loadedAt: new Date(),
      };

      const entries = Object.entries(compiled.bundleFiles).map(([nodeId, f]) => ({ nodeId, code: f.code }));
      deployment.moduleCache = await ModuleLoader.loadMany(entries);

      this.nodeIndex.removeAgentNodes(name);

      for (const [nodeId, mod] of deployment.moduleCache) {
        this.nodeIndex.set(nodeId, {
          agentName: name,
          deploymentHash: compiled.hash,
          module: mod,
        });
      }

      const agent = this.agents.get(name) ?? {
        name,
        runtime: null,
        history: this.deploymentHistory.create(),
        executionPins: new Map(),
      };

      this.deploymentHistory.register(agent.history, compiled.hash, deployment);
      this.agents.set(name, { ...agent, runtime: deployment });

      this.eventBusRef.emit({
        type: "agent_updated",
        agentName: name,
        deploymentHash: compiled.hash,
        generation,
        changeType: "code",
        timestamp: new Date().toISOString(),
      });
    });
  }

  async handleResolve(agentName: string): Promise<{
    deploymentHash: string;
    routingTable: CompiledDeployment["routingTable"];
    capabilities: CompiledDeployment["capabilities"];
    generation: number;
  } | null> {
    const runtime = this.getRuntimeDeployment(agentName);
    if (!runtime) return null;
    return {
      deploymentHash: runtime.compiled.hash,
      routingTable: runtime.compiled.routingTable,
      capabilities: runtime.compiled.capabilities,
      generation: runtime.generation,
    };
  }

  async handleInvoke(params: {
    agentName: string;
    executionId?: string;
    nodeId: string;
    input: unknown;
  }): Promise<unknown> {
    const { agentName, executionId, nodeId, input } = params;

    const deployment = executionId
      ? this.executionPinning.getDeploymentForExecution(agentName, executionId, this.agents)
      : this.getRuntimeDeployment(agentName);

    if (!deployment) {
      throw new Error(`No deployment for agent "${agentName}"`);
    }

    const mod = deployment.moduleCache.get(nodeId);
    if (!mod) {
      throw new Error(`Node "${nodeId}" not found in deployment ${deployment.compiled.hash}`);
    }

    if (typeof mod.defaultExport !== "function") {
      throw new Error(`Node "${nodeId}" has no executable defaultExport`);
    }

    return mod.defaultExport(input);
  }

  pinExecution(agentName: string, executionId: string): string {
    return this.executionPinning.pin(agentName, executionId, this.agents);
  }

  completeExecution(agentName: string, executionId: string): void {
    this.executionPinning.unpin(agentName, executionId, this.agents);
  }

  getRuntimeDeployment(name: string): RuntimeDeployment | null {
    return this.agents.get(name)?.runtime ?? null;
  }

  getAllAgentNames(): string[] {
    return Array.from(this.agents.keys());
  }

  get eventBusRef(): EventBus { return this.eventBus; }
  get metricsRef(): MetricsCollector { return this.metrics; }
}
