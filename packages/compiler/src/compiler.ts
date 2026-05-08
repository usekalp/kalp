import { createJiti } from "jiti";
import { getRegistry, clearRegistry } from "@kalphq/sdk";
import { bundleHandler, ensureHandlersDir } from "./bundler";
import { buildSchemaIR, sortKeys } from "./ir-generator";
import { createHash } from "crypto";
import { createRequire } from "module";
import fs from "node:fs";
import path from "node:path";

// Assert unique IDs
function assertUniqueIds(registry: ReturnType<typeof getRegistry>) {
  const seen = new Set<string>();
  for (const [key, entry] of registry.entries()) {
    if (seen.has(entry.id)) {
      throw new Error(`Duplicate node id: ${entry.id}`);
    }
    seen.add(entry.id);
  }
}

// NPM-safe SDK version retrieval (bundler-safe)
function getSdkVersion(): string {
  try {
    // String-based require to avoid esbuild trying to resolve at build time
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const require = (0, eval)("require");
    const pkgPath = require.resolve("@kalphq/sdk/package.json");
    const pkg = require(pkgPath);
    return pkg.version;
  } catch {
    return "unknown";
  }
}

/**
 * Calculates the IR hash for identity validation.
 * This function includes sortKeys internally to ensure deterministic hashing
 * across different environments (CLI and Cloud).
 *
 * @param ir - The IR object (without meta field)
 * @returns SHA-256 hash of the sorted IR
 */
export function calculateIRHash(ir: any): string {
  const sortedIR = sortKeys(ir);
  return createHash("sha256").update(JSON.stringify(sortedIR)).digest("hex");
}

/**
 * Calculates the complete agent hash including IR and handler bundles.
 * This is the unified hash function used by both CLI and Cloud for
 * deterministic identity validation.
 *
 * @param ir - The IR object (without meta/irHash fields)
 * @param handlers - Record of handler entries with hash property
 * @returns SHA-256 hash of the combined IR + handlers
 */
export function calculateAgentHash(
  ir: any,
  handlers: Record<string, { hash: string }>,
): string {
  // Remove meta and irHash from IR before hashing
  const irWithoutMeta = { ...ir };
  delete irWithoutMeta.meta;
  delete irWithoutMeta.irHash;

  // Sort and hash IR
  const sortedIR = sortKeys(irWithoutMeta);
  const irHash = createHash("sha256")
    .update(JSON.stringify(sortedIR))
    .digest("hex");

  // Sort and combine handler hashes
  const sortedHandlerHashes = Object.keys(handlers)
    .sort()
    .map((k) => handlers[k]!.hash)
    .join("|");

  // Combine IR hash + handler hashes
  return createHash("sha256")
    .update(irHash + "|" + sortedHandlerHashes)
    .digest("hex");
}

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

    const ir: any = {
      agent: {
        name: agentConfig.name,
        description: agentConfig.description,
        systemPrompt: agentConfig.systemPrompt
          ? typeof agentConfig.systemPrompt === "function"
            ? { type: "function", dynamic: true }
            : agentConfig.systemPrompt
          : undefined,
        hooks: {},
      },
      steps: {},
      tools: {},
      routes: {},
      schedules: {},
    };

    if (agentConfig.contract) {
      const { schema: inputSchema } = buildSchemaIR(
        agentConfig.contract.inputSchema,
      );
      const { schema: outputSchema } = buildSchemaIR(
        agentConfig.contract.outputSchema,
      );
      ir.agent.contract = {
        agentId: agentConfig.contract.agentId,
        inputSchema,
        outputSchema,
      };
    }

    // Resolve exports dynamically and bundle
    const fileExportsCache = new Map<string, any>();
    async function getModuleExports(filePath: string) {
      const resolvedPath = path.resolve(filePath);
      if (!fileExportsCache.has(resolvedPath)) {
        fileExportsCache.set(resolvedPath, await jiti.import(resolvedPath));
      }
      return fileExportsCache.get(resolvedPath);
    }

    // Process registry steps & tools
    for (const [key, entry] of registry.entries()) {
      const { kind, id, ref } = entry;
      const node = ref as any;
      const internalId = node.__internalId;
      const filePath = node.__filePath;

      if (!filePath) throw new Error(`Missing filePath for node ${id}`);

      const modExports = await getModuleExports(filePath);
      const exported = Object.entries(modExports).find(
        ([_, value]) => (value as any)?.__internalId === internalId,
      );

      if (!exported) {
        throw new Error(
          `Cannot resolve handler export for node "${id}" in ${filePath}`,
        );
      }

      // bundleHandler(filePath, outDir, exportName, isNode)
      const bundleRes = await bundleHandler(
        filePath,
        outDir,
        exported[0],
        true,
      );

      const { schema: inSchema, meta: inMeta } = buildSchemaIR(
        node.inputSchema,
      );
      const { schema: outSchema } = buildSchemaIR(node.outputSchema);

      const irNode = {
        id,
        description: node.description,
        kind,
        inputSchema: inSchema,
        inputSchemaMeta: inMeta,
        outputSchema: outSchema,
        handlerFile: bundleRes.handlerFile,
        handlerVersion: bundleRes.hash,
      };

      if (kind === "step") ir.steps[id] = irNode;
      if (kind === "tool") ir.tools[id] = irNode;
    }

    // Process hooks
    const hooks = ["onMessage", "onCall", "onInit", "onTick"];
    for (const hook of hooks) {
      if (agentConfig[hook]) {
        const bundleRes = await bundleHandler(
          entryFullPath,
          outDir,
          hook,
          false,
        );
        ir.agent.hooks[hook] = {
          type: "agent_entry",
          signature: "agent_context",
          handlerFile: bundleRes.handlerFile,
          handlerVersion: bundleRes.hash,
        };
      }
    }

    // Process routes
    if (Array.isArray(agentConfig.routes)) {
      for (const route of agentConfig.routes) {
        const internalId = route.__internalId;
        const filePath = route.__filePath;

        if (!filePath)
          throw new Error(
            `Missing filePath for route ${route.id || route.path}`,
          );

        const modExports = await getModuleExports(filePath);
        const exported = Object.entries(modExports).find(
          ([_, value]) => (value as any)?.__internalId === internalId,
        );

        if (!exported) {
          throw new Error(
            `Cannot resolve handler export for route in ${filePath}`,
          );
        }

        const id = route.id || `${route.method}:${route.path}`;
        const routeKey = `${route.method}:${route.path}`;

        const bundleRes = await bundleHandler(
          filePath,
          outDir,
          exported[0],
          false,
        );

        const { schema: inSchema, meta: inMeta } = buildSchemaIR(
          route.inputSchema,
        );

        ir.routes[routeKey] = {
          method: route.method,
          path: route.path,
          inputSchema: inSchema,
          inputSchemaMeta: inMeta,
          handlerFile: bundleRes.handlerFile,
          handlerVersion: bundleRes.hash,
        };
      }
    }

    // Process cron schedules
    if (Array.isArray(agentConfig.cron)) {
      for (let i = 0; i < agentConfig.cron.length; i++) {
        const schedule = agentConfig.cron[i];
        const scheduleId = `schedule:${i}`;

        // Bundle the cron handler
        const bundleRes = await bundleHandler(
          entryFullPath,
          outDir,
          `cron[${i}]`,
          false,
        );

        ir.schedules[scheduleId] = {
          kind: "schedule",
          id: scheduleId,
          cron: schedule.expression,
          handler: scheduleId,
          timezone: schedule.timezone,
          handlerFile: bundleRes.handlerFile,
          handlerVersion: bundleRes.hash,
        };
      }
    }

    // Hash and write (hash excludes meta for stable identity)
    const irHash = calculateIRHash(ir);

    // Add metadata after hash calculation (meta is not part of identity)
    const sortedIR = sortKeys(ir);
    sortedIR.meta = {
      kalpVersion: getSdkVersion(),
      buildTimestamp: Date.now(),
      nodeVersion: process.version,
    };
    sortedIR.irHash = irHash;

    fs.writeFileSync(
      path.join(outDir, "ir.json"),
      JSON.stringify(sortedIR, null, 2),
      "utf-8",
    );
  } finally {
    clearRegistry();
  }
}
