export type {
  AgentManifestV1,
  ManifestVersionRecord,
  ManifestRegistryEntry,
  LoadedAgentModule,
  AgentItemWithInput,
  AgentStepItem,
  AgentRouteItem,
  AgentFlowItem,
} from "@/utils/manifest/types";

export {
  asRecord,
  asString,
  asArray,
  toJsonSchema,
} from "@/utils/manifest/types";

export {
  serializeSystemPrompt,
  serializeSteps,
  serializeTools,
  serializeRoutes,
  serializeFlows,
} from "@/utils/manifest/serialize";

export { loadAgentModule, cleanupTempDir } from "@/utils/manifest/build";

export { createVersionId, getManifestHash } from "@/utils/manifest/hash";

export {
  writeVersionedManifest,
  readLatestVersionedManifest,
} from "@/utils/manifest/io";

// Main function to read agent manifest
import { access } from "node:fs/promises";
import { join } from "node:path";
import { loadAgentModule, cleanupTempDir } from "@/utils/manifest/build";
import {
  serializeSystemPrompt,
  serializeSteps,
  serializeTools,
  serializeRoutes,
  serializeFlows,
} from "@/utils/manifest/serialize";
import {
  asRecord,
  asString,
  asArray,
  type AgentManifestV1,
} from "@/utils/manifest/types";

export async function readAgentManifest(params: {
  cwd: string;
  agentName: string;
}): Promise<AgentManifestV1> {
  const { cwd, agentName } = params;
  const agentPath = join(cwd, "agents", agentName, "index.ts");
  await access(agentPath);

  let tempDir: string | undefined;

  try {
    const loaded = await loadAgentModule(agentPath, cwd);
    tempDir = loaded.tempDir;
    const agent = asRecord(loaded.agent);
    const steps = serializeSteps(asArray(agent.steps));
    const tools = serializeTools(asArray(agent.tools));
    const routes = serializeRoutes(asArray(agent.routes));
    const stepIds = new Set(steps.map((step) => step.id));
    const flows = serializeFlows(asArray(agent.flows), stepIds);

    return {
      format: "kalp-agent-manifest",
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      codeHash: loaded.codeHash,
      agent: {
        id: asString(agent.id),
        name: asString(agent.name) ?? agentName,
        description: asString(agent.description) ?? "",
        systemPrompt: serializeSystemPrompt(agent.systemPrompt),
        lifecycle: {
          onInit: typeof agent.onInit === "function",
          onMessage: typeof agent.onMessage === "function",
          onTick: typeof agent.onTick === "function",
        },
        actions: {
          ai: true,
          wait: true,
          fetch: true,
          runStep: true,
          callTool: true,
          runFlow: true,
        },
        steps,
        tools,
        routes,
        flows,
        execution: {
          stepOrder: steps.map((step) => step.id),
          toolOrder: tools.map((tool) => tool.id),
          routeOrder: routes.map((route) => route.id),
          flowOrder: flows.map((flow) => flow.id),
        },
      },
    };
  } finally {
    if (tempDir) {
      await cleanupTempDir(tempDir);
    }
  }
}
