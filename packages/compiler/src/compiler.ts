import { createJiti } from "jiti";
import { getRegistry, clearRegistry } from "@kalphq/sdk";
import { ensureHandlersDir } from "./bundler";
import { processRegistrySteps, processHooks, processRoutes, processListeners, processCron } from "./ir-builder";
import { createAgentManifest } from "./manifest";
import fs from "node:fs";
import path from "node:path";
import {
  serializeEmits,
  assertUniqueIds,
  getSdkVersion,
  getCompilerVersion,
  calculateIRHash,
  sortKeys
} from "./utils";

export { calculateAgentHash, calculateIRHash } from "./utils";

export async function buildAgent(
  entryPath: string,
  outDir: string,
  projectRoot?: string,
) {
  try {
    clearRegistry();

    // Normalize paths
    const entryFullPath = path.resolve(entryPath);
    const jitiBase = projectRoot
      ? path.resolve(projectRoot)
      : path.dirname(entryFullPath);

    // Ensure handlers directory exists
    ensureHandlersDir(outDir);

    // Create jiti instance (using jitiBase as root for resolution)
    const jiti = createJiti(jitiBase, {
      interopDefault: true,
    });

    // After importing, the default export should be our agent config
    const mod = await jiti.import(entryFullPath);
    const agentConfig: any = (mod as any).default || mod;

    const registry = getRegistry();
    assertUniqueIds(registry);

    // IRv2 format
    const ir: any = {
      version: 2,
      agent: createAgentManifest(agentConfig),
      nodes: {},
      bundles: {},
    };

    // Resolve exports dynamically and bundle
    const fileExportsCache = new Map<string, any>();
    async function getModuleExports(filePath: string) {
      const resolvedPath = path.resolve(filePath);
      if (!fileExportsCache.has(resolvedPath)) {
        fileExportsCache.set(resolvedPath, await jiti.import(resolvedPath));
      }
      return fileExportsCache.get(resolvedPath);
    }

    // Helper to store bundle
    function storeBundle(hash: string, code: string): void {
      ir.bundles[hash] = { code, hash };
    }

    // Agent-level emits
    const agentEmits = serializeEmits(agentConfig.name, agentConfig.contract?.emits);

    // Setup Compiler Context
    const ctx = {
      ir,
      outDir,
      agentEmits,
      entryFullPath,
      jiti,
      fileExportsCache,
      storeBundle,
      getModuleExports,
    };

    // Process everything modularly
    await processRegistrySteps(registry, ctx);
    await processHooks(agentConfig, ctx);
    await processRoutes(agentConfig, ctx);
    await processListeners(agentConfig, ctx);
    await processCron(agentConfig, ctx);

    // Hash and write (hash excludes meta for stable identity)
    const irHash = calculateIRHash(ir);

    // Add metadata after hash calculation (meta is not part of identity)
    const sortedIR = sortKeys(ir);
    (sortedIR as any).meta = {
      sdkVersion: getSdkVersion(),
      compilerVersion: getCompilerVersion(),
      buildTimestamp: Date.now(),
    };
    (sortedIR as any).irHash = irHash;

    fs.writeFileSync(
      path.join(outDir, "ir.json"),
      JSON.stringify(sortedIR, null, 2),
      "utf-8",
    );
  } finally {
    clearRegistry();
  }
}
