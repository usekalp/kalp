import { createJiti } from "jiti";
import { clearRegistry, getRegistry } from "@kalphq/sdk";
import type {
  ArtifactManifest,
  BundleManifest,
  IRGraph,
  NodeDescriptor,
  IRNodeKind,
  SchemaRegistry,
} from "@kalphq/sdk";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { ensureArtifactsDirs } from "./bundler";
import {
  processContracts,
  processCron,
  processHooks,
  processRegistryNodes,
  processRoutes,
  type CompilerContext,
  type DebugNodeMetadata,
  createBundleBinding,
} from "./ir-builder";
import {
  assertUniqueRegistryIds,
  calculateArtifactHash,
  calculateDeploymentHash,
  calculateSemanticHash,
  createNodeId,
  createSchemaId,
  hashJson,
  normalizeRelativeModulePath,
  sortKeys,
} from "./utils";
import {
  createAgentManifest,
  createRequirementsManifest,
  createSemanticIr,
} from "./manifest";
import { buildSchemaIR } from "./ir-generator";
import { analyzeHandlerFile, buildManifest } from "./tracing";
import { findExportPosition } from "./tracing/source-locations";
import type { HandlerSourceAnalysis } from "./tracing/types";

const require = createRequire(import.meta.url);
const DEFAULT_TARGET = "default";
const ABI_VERSION = 1;

export interface BuildAgentOptions {
  includeDebug?: boolean;
}

export interface BuildAgentResult {
  artifactDir: string;
  semanticHash: string;
  artifactHash: string;
  deploymentHash: string;
}

function collectExportedRegistryEntries(mod: any) {
  const collected = new Map<string, { kind: "tool" | "listener"; id: string; ref: unknown }>();

  for (const [exportName, value] of Object.entries(mod ?? {})) {
    if (exportName === "default" || !value || typeof value !== "object") {
      continue;
    }

    const node = value as any;
    if (node.kind === "tool" && typeof node.id === "string") {
      collected.set(`tools.${node.id}`, { kind: "tool", id: node.id, ref: node });
      continue;
    }

    if (node.kind === "listener" && typeof node.event === "string") {
      collected.set(`listeners.${node.event}`, {
        kind: "listener",
        id: node.event,
        ref: node,
      });
    }
  }

  return collected;
}

function createCompilerState() {
  const nodes: Record<string, NodeDescriptor> = {};
  const schemas: SchemaRegistry = {};
  const debug: Record<string, DebugNodeMetadata> = {};
  const bundleManifest: BundleManifest = {
    schemaVersion: 3,
    targets: {
      [DEFAULT_TARGET]: {
        abiVersion: ABI_VERSION,
        nodes: {},
      },
    },
  };
  const sourceAnalysis: HandlerSourceAnalysis[] = [];
  const sourceCache = new Map<string, string>();

  return {
    nodes,
    schemas,
    debug,
    bundleManifest,
    stableNames: new Set<string>(),
    sourceAnalysis,
    sourceCache,
  };
}

function purgeProjectModuleCache(projectRoot: string): void {
  const normalizedRoot = path.resolve(projectRoot).replace(/\\/g, "/");
  for (const cacheKey of Object.keys(require.cache)) {
    const normalizedKey = cacheKey.replace(/\\/g, "/");
    if (normalizedKey === normalizedRoot || normalizedKey.startsWith(normalizedRoot + "/")) {
      delete require.cache[cacheKey];
    }
  }
}

export async function buildAgent(
  entryPath: string,
  outDir: string,
  projectRoot?: string,
  options: BuildAgentOptions = {},
): Promise<BuildAgentResult> {
  const includeDebug = options.includeDebug ?? true;

  try {
    clearRegistry();

    const entryFullPath = path.resolve(entryPath);
    const resolvedProjectRoot = path.resolve(projectRoot ?? path.dirname(entryFullPath));
    const jitiBase = resolvedProjectRoot;

    const { artifactsDir, bundlesDir } = ensureArtifactsDirs(outDir);
    fs.rmSync(artifactsDir, { recursive: true, force: true });
    fs.mkdirSync(bundlesDir, { recursive: true });

    const jiti = createJiti(jitiBase, {
      fsCache: false,
      moduleCache: true,
      interopDefault: true,
    });

    purgeProjectModuleCache(resolvedProjectRoot);
    const mod = await jiti.import(entryFullPath);
    const agentConfig: any = (mod as any).default || mod;

    const registry = new Map(getRegistry());
    for (const [key, entry] of collectExportedRegistryEntries(mod)) {
      if (!registry.has(key)) {
        registry.set(key, entry as any);
      }
    }
    assertUniqueRegistryIds(registry);

    const state = createCompilerState();
    const fileExportsCache = new Map<string, any>();

    async function getModuleExports(filePath: string) {
      const resolvedPath = path.resolve(filePath);
      if (!fileExportsCache.has(resolvedPath)) {
        fileExportsCache.set(resolvedPath, await jiti.import(resolvedPath));
      }
      return fileExportsCache.get(resolvedPath);
    }

    function registerSchema(schema?: unknown): string | undefined {
      if (!schema) {
        return undefined;
      }

      const { schema: jsonSchema } = buildSchemaIR(schema as any);
      const schemaHash = hashJson(jsonSchema);
      const schemaId = createSchemaId(schemaHash);

      if (!state.schemas[schemaId]) {
        state.schemas[schemaId] = {
          type: "json-schema",
          source: "zod",
          hash: schemaHash,
          schema: sortKeys(jsonSchema),
        };
      }

      return schemaId;
    }

async function registerNode(node: {
      kind: IRNodeKind;
      name?: string;
      stableName: string;
      inputSchema?: string;
      outputSchema?: string;
      trigger?: NodeDescriptor["trigger"];
      listener?: NodeDescriptor["listener"];
      http?: NodeDescriptor["http"];
      schedule?: NodeDescriptor["schedule"];
      filePath: string;
      exportName: string;
    }) {
      if (state.stableNames.has(node.stableName)) {
        throw new Error(`Duplicate stableName: ${node.stableName}`);
      }

      const relativeModule = normalizeRelativeModulePath(node.filePath, resolvedProjectRoot);
      const nodeId = createNodeId(node.kind, relativeModule, node.exportName);
      if (state.nodes[nodeId]) {
        throw new Error(`Duplicate opaque node id: ${nodeId}`);
      }

      const bundleBinding = await createBundleBinding(node.filePath, bundlesDir, node.exportName);

      const absoluteFile = path.resolve(node.filePath);
      let sourceLine: number | undefined;
      let sourceColumn: number | undefined;
      try {
        let source = state.sourceCache.get(absoluteFile);
        if (!source) {
          source = fs.readFileSync(absoluteFile, "utf-8");
          state.sourceCache.set(absoluteFile, source);
        }
        const pos = findExportPosition(source, node.exportName);
        if (pos) {
          sourceLine = pos.line;
          sourceColumn = pos.column;
        }
      } catch {}

      state.nodes[nodeId] = {
        id: nodeId,
        stableName: node.stableName,
        kind: node.kind,
        ...(node.name ? { name: node.name } : {}),
        ...(node.inputSchema ? { inputSchema: node.inputSchema } : {}),
        ...(node.outputSchema ? { outputSchema: node.outputSchema } : {}),
        ...(node.trigger ? { trigger: node.trigger } : {}),
        ...(node.listener ? { listener: node.listener } : {}),
        ...(node.http ? { http: node.http } : {}),
        ...(node.schedule ? { schedule: node.schedule } : {}),
      };
      state.bundleManifest.targets[DEFAULT_TARGET]!.nodes[nodeId] = bundleBinding;
      state.debug[nodeId] = {
        absoluteFile,
        relativeModule,
        export: node.exportName,
        line: sourceLine,
        column: sourceColumn,
      };
      state.stableNames.add(node.stableName);

      try {
        const analysis = analyzeHandlerFile(
          absoluteFile,
          relativeModule,
          node.exportName,
          node.stableName,
          nodeId,
        );
        if (analysis) {
          state.sourceAnalysis.push(analysis);
        }
      } catch {}
    }

    const compilerContext: CompilerContext = {
      outDir,
      entryFullPath,
      agentName: agentConfig.name,
      getModuleExports,
      registerSchema,
      registerNode,
      stableNames: state.stableNames,
      sourceAnalysis: state.sourceAnalysis,
    };

    await processRegistryNodes(registry, compilerContext);
    await processHooks(agentConfig, compilerContext);
    await processContracts(agentConfig, compilerContext);
    await processRoutes(agentConfig, compilerContext);
    await processCron(agentConfig, compilerContext);

    const stateSchemaId = registerSchema(agentConfig.state);
    const semanticIr: IRGraph = createSemanticIr({
      agent: createAgentManifest(agentConfig, stateSchemaId),
      nodes: state.nodes,
      requirements: createRequirementsManifest({
        hasState: Boolean(stateSchemaId),
        hasListeners: Object.values(state.nodes).some((node) => node.kind === "listener"),
      }),
    });

    const semanticHash = calculateSemanticHash(semanticIr, state.schemas);
    const bundleTargetManifest = state.bundleManifest.targets[DEFAULT_TARGET]!;
    const artifactHash = calculateArtifactHash(bundleTargetManifest);
    const deploymentHash = calculateDeploymentHash(semanticHash, artifactHash, ABI_VERSION);

    const artifactManifest: ArtifactManifest = {
      schemaVersion: 3,
      semanticHash,
      files: {
        semanticIr: "./semantic-ir.json",
        schemas: "./schemas.json",
        bundleManifest: "./bundle-manifest.json",
      },
      targets: {
        [DEFAULT_TARGET]: {
          abiVersion: ABI_VERSION,
          artifactHash,
          deploymentHash,
        },
      },
    };

    const writes: Array<[string, unknown]> = [
      [path.join(artifactsDir, "semantic-ir.json"), semanticIr],
      [path.join(artifactsDir, "schemas.json"), state.schemas],
      [path.join(artifactsDir, "bundle-manifest.json"), state.bundleManifest],
      [path.join(artifactsDir, "artifact-manifest.json"), artifactManifest],
    ];

    if (includeDebug) {
      writes.push([path.join(artifactsDir, "debug.json"), state.debug]);
    }

    if (state.sourceAnalysis.length > 0) {
      const sourceMetadata = buildManifest(state.sourceAnalysis);
      writes.push([path.join(artifactsDir, "source-metadata.json"), sourceMetadata]);
    }

    for (const [filePath, value] of writes) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, `${JSON.stringify(sortKeys(value), null, 2)}\n`, "utf-8");
    }

    return {
      artifactDir: artifactsDir,
      semanticHash,
      artifactHash,
      deploymentHash,
    };
  } finally {
    clearRegistry();
  }
}

export {
  calculateArtifactHash,
  calculateDeploymentHash,
  calculateSemanticHash,
} from "./utils";
