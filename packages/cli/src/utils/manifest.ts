import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import {
  access,
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import type { ZodTypeAny } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

export interface AgentManifestV1 {
  format: "kalp-agent-manifest";
  schemaVersion: 1;
  generatedAt: string;
  agent: {
    id?: string;
    name: string;
    description: string;
    systemPrompt:
      | { type: "static"; value: string }
      | { type: "dynamic" }
      | { type: "none" };
    lifecycle: {
      onInit: boolean;
      onMessage: boolean;
      onTick: boolean;
    };
    actions: {
      ai: boolean;
      wait: boolean;
      fetch: boolean;
      runStep: boolean;
      callTool: boolean;
      runFlow: boolean;
    };
    steps: Array<{
      id: string;
      order: number;
      description: string;
      inputSchema: Record<string, unknown> | null;
      outputSchema: Record<string, unknown> | null;
    }>;
    tools: Array<{
      id: string;
      order: number;
      description: string;
      inputSchema: Record<string, unknown> | null;
    }>;
    routes: Array<{
      id: string;
      order: number;
      method: string;
      path: string;
      inputSchema: Record<string, unknown> | null;
    }>;
    flows: Array<{
      id: string;
      order: number;
      description: string;
      steps: Array<{
        order: number;
        stepId: string;
        existsInAgentSteps: boolean;
      }>;
    }>;
    execution: {
      stepOrder: string[];
      toolOrder: string[];
      routeOrder: string[];
      flowOrder: string[];
    };
  };
}

export interface ManifestVersionRecord {
  version: number;
  versionId: string;
  hash: string;
  generatedAt: string;
  immutable: true;
  manifest: AgentManifestV1;
}

interface ManifestRegistryEntry {
  latest: string;
  versions: string[];
}

interface LoadedAgentModule {
  agent: unknown;
  tempDir: string;
}

interface AgentItemWithInput {
  id?: unknown;
  description?: unknown;
  input?: unknown;
}

interface AgentStepItem extends AgentItemWithInput {
  output?: unknown;
}

interface AgentRouteItem extends AgentItemWithInput {
  method?: unknown;
  path?: unknown;
}

interface AgentFlowItem {
  id?: unknown;
  description?: unknown;
  steps?: unknown;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toJsonSchema(
  schema: unknown,
  name: string,
): Record<string, unknown> | null {
  try {
    return zodToJsonSchema(schema as ZodTypeAny, name) as Record<
      string,
      unknown
    >;
  } catch {
    return null;
  }
}

function serializeSystemPrompt(
  systemPrompt: unknown,
): AgentManifestV1["agent"]["systemPrompt"] {
  if (typeof systemPrompt === "string") {
    return { type: "static", value: systemPrompt };
  }

  if (typeof systemPrompt === "function") {
    return { type: "dynamic" };
  }

  return { type: "none" };
}

function serializeSteps(steps: unknown[]): AgentManifestV1["agent"]["steps"] {
  return steps.map((step, index) => {
    const item = asRecord(step) as AgentStepItem;
    return {
      id: asString(item.id) ?? `step_${index + 1}`,
      order: index + 1,
      description: asString(item.description) ?? "",
      inputSchema: toJsonSchema(item.input, `step_${index + 1}_input`),
      outputSchema: toJsonSchema(item.output, `step_${index + 1}_output`),
    };
  });
}

function serializeTools(tools: unknown[]): AgentManifestV1["agent"]["tools"] {
  return tools.map((tool, index) => {
    const item = asRecord(tool) as AgentItemWithInput;
    return {
      id: asString(item.id) ?? `tool_${index + 1}`,
      order: index + 1,
      description: asString(item.description) ?? "",
      inputSchema: toJsonSchema(item.input, `tool_${index + 1}_input`),
    };
  });
}

function serializeRoutes(
  routes: unknown[],
): AgentManifestV1["agent"]["routes"] {
  return routes.map((route, index) => {
    const item = asRecord(route) as AgentRouteItem;
    return {
      id: asString(item.id) ?? `route_${index + 1}`,
      order: index + 1,
      method: asString(item.method) ?? "GET",
      path: asString(item.path) ?? "/",
      inputSchema: toJsonSchema(item.input, `route_${index + 1}_input`),
    };
  });
}

function serializeFlows(
  flows: unknown[],
  stepIds: Set<string>,
): AgentManifestV1["agent"]["flows"] {
  return flows.map((flow, index) => {
    const item = asRecord(flow) as AgentFlowItem;
    const steps = asArray(item.steps).map((s, stepIndex) => {
      const step = asRecord(s);
      const stepId = asString(step.id) ?? `step_${stepIndex + 1}`;
      return {
        order: stepIndex + 1,
        stepId,
        existsInAgentSteps: stepIds.has(stepId),
      };
    });

    return {
      id: asString(item.id) ?? `flow_${index + 1}`,
      order: index + 1,
      description: asString(item.description) ?? "",
      steps,
    };
  });
}

async function loadAgentModule(
  agentPath: string,
  cwd: string,
): Promise<LoadedAgentModule> {
  const tempDir = await mkdtemp(join(cwd, ".kalp-manifest-"));
  const outFile = join(tempDir, "agent.manifest.mjs");

  await build({
    entryPoints: [agentPath],
    outfile: outFile,
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node18",
    logLevel: "silent",
    packages: "external",
    plugins: [
      {
        name: "relative-js-to-ts",
        setup(buildCtx) {
          buildCtx.onResolve({ filter: /^\.+\/.*\.js$/ }, (args) => {
            const resolved = resolve(args.resolveDir, args.path);
            if (existsSync(resolved)) {
              return { path: resolved };
            }

            const tsPath = resolved.replace(/\.js$/, ".ts");
            if (existsSync(tsPath)) {
              return { path: tsPath };
            }

            const tsxPath = resolved.replace(/\.js$/, ".tsx");
            if (existsSync(tsxPath)) {
              return { path: tsxPath };
            }

            return null;
          });
        },
      },
    ],
  });

  const loaded = (await import(
    `${pathToFileURL(outFile).href}?t=${Date.now()}`
  )) as { default?: unknown };

  return {
    agent: loaded.default,
    tempDir,
  };
}

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
      await rm(tempDir, { recursive: true, force: true });
    }
  }
}

function getHash(payload: string): string {
  return createHash("sha256").update(payload).digest("hex");
}

function isManifestVersionFile(fileName: string): boolean {
  return fileName.endsWith(".json");
}

function createVersionId(payload: string, generatedAt: string): string {
  return createHash("sha256")
    .update(payload)
    .update(generatedAt)
    .digest("hex")
    .slice(0, 8);
}

async function readManifestVersionFile(
  filePath: string,
): Promise<ManifestVersionRecord | null> {
  try {
    const src = await readFile(filePath, "utf-8");
    return JSON.parse(src) as ManifestVersionRecord;
  } catch {
    return null;
  }
}

export async function writeVersionedManifest(params: {
  cwd: string;
  agentName: string;
  manifest: AgentManifestV1;
}): Promise<ManifestVersionRecord & { outputPath: string }> {
  const { cwd, agentName, manifest } = params;
  const agentMetaDir = join(cwd, "meta", "migrations", agentName);
  await mkdir(agentMetaDir, { recursive: true });

  const files = await readdir(agentMetaDir);
  const versionFiles = files.filter(isManifestVersionFile);
  const existingRecords = (
    await Promise.all(
      versionFiles.map((file) =>
        readManifestVersionFile(join(agentMetaDir, file)),
      ),
    )
  ).filter((record): record is ManifestVersionRecord => record !== null);

  const latestVersion =
    existingRecords
      .map((record) => record.version)
      .sort((a, b) => a - b)
      .at(-1) ?? 0;
  const nextVersion = latestVersion + 1;

  const payload = JSON.stringify(manifest);
  const generatedAt = new Date().toISOString();
  const versionId = createVersionId(payload, generatedAt);
  const record: ManifestVersionRecord = {
    version: nextVersion,
    versionId,
    hash: getHash(payload),
    generatedAt,
    immutable: true,
    manifest,
  };

  const versionFile = join(agentMetaDir, `${versionId}.json`);
  await writeFile(versionFile, JSON.stringify(record, null, 2) + "\n", "utf-8");

  const snapshotPath = join(cwd, "meta", "snapshot.json");
  const snapshot = await readSnapshot(snapshotPath);
  const prev = snapshot[agentName] ?? { latest: "", versions: [] };
  const versions = prev.versions.includes(versionId)
    ? prev.versions
    : [...prev.versions, versionId];
  snapshot[agentName] = { latest: versionId, versions };
  await writeFile(
    snapshotPath,
    JSON.stringify(snapshot, null, 2) + "\n",
    "utf-8",
  );

  return {
    ...record,
    outputPath: versionFile,
  };
}

export async function readLatestVersionedManifest(params: {
  cwd: string;
  agentName: string;
}): Promise<(ManifestVersionRecord & { outputPath: string }) | null> {
  const { cwd, agentName } = params;
  const agentMetaDir = join(cwd, "meta", "migrations", agentName);
  const snapshotPath = join(cwd, "meta", "snapshot.json");

  // Try to read from snapshot first
  const snapshot = await readSnapshot(snapshotPath);
  const agentEntry = snapshot[agentName];

  if (agentEntry?.latest) {
    const latestFile = join(agentMetaDir, `${agentEntry.latest}.json`);
    const latest = await readManifestVersionFile(latestFile);
    if (latest) {
      return {
        ...latest,
        outputPath: latestFile,
      };
    }
  }

  // Fallback: scan directory and find latest by version number
  const files = await readdir(agentMetaDir).catch(() => [] as string[]);
  const records = (
    await Promise.all(
      files
        .filter(isManifestVersionFile)
        .map((file) => readManifestVersionFile(join(agentMetaDir, file))),
    )
  ).filter((record): record is ManifestVersionRecord => record !== null);

  if (records.length === 0) {
    return null;
  }

  const newest = records.sort((a, b) => b.version - a.version)[0] ?? null;
  if (!newest) {
    return null;
  }

  return {
    ...newest,
    outputPath: join(agentMetaDir, `${newest.versionId}.json`),
  };
}

async function readSnapshot(
  snapshotPath: string,
): Promise<Record<string, ManifestRegistryEntry>> {
  try {
    const src = await readFile(snapshotPath, "utf-8");
    return JSON.parse(src) as Record<string, ManifestRegistryEntry>;
  } catch {
    return {};
  }
}
