import { createJiti } from "jiti";
import { getRegistry, clearRegistry } from "@kalphq/sdk";
import { bundleHandler, ensureHandlersDir } from "./bundler";
import { buildSchemaIR, sortKeys } from "./ir-generator";
import { createHash } from "crypto";
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

    // v3 Manifest format: static registry only, no graph edges
    const ir: {
      version: 3;
      metadata: {
        name: string;
        description?: string;
        systemPrompt?: string | { type: "function"; dynamic: true };
      };
      entries: Record<string, string>; // event name -> handler hash
      bundles: Record<
        string,
        {
          code: string;
          type: "entry" | "step" | "tool" | "route";
          inputSchema?: Record<string, unknown>;
          outputSchema?: Record<string, unknown>;
        }
      >;
      schedules?: Record<
        string,
        {
          cron: string;
          handlerHash: string;
          timezone?: string;
        }
      >;
    } = {
      version: 3,
      metadata: {
        name: agentConfig.name,
        description: agentConfig.description,
        systemPrompt: agentConfig.systemPrompt
          ? typeof agentConfig.systemPrompt === "function"
            ? { type: "function", dynamic: true }
            : agentConfig.systemPrompt
          : undefined,
      },
      entries: {},
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

    // Helper to store bundle and return hash
    function storeBundle(
      hash: string,
      code: string,
      type: "entry" | "step" | "tool" | "route",
      inputSchema?: Record<string, unknown>,
      outputSchema?: Record<string, unknown>,
    ): void {
      ir.bundles[hash] = {
        code,
        type,
        ...(inputSchema && { inputSchema }),
        ...(outputSchema && { outputSchema }),
      };
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

      // Bundle the handler
      const bundleRes = await bundleHandler(
        filePath,
        outDir,
        exported[0],
        true,
      );

      const { schema: inSchema } = buildSchemaIR(node.inputSchema);
      const { schema: outSchema } = buildSchemaIR(node.outputSchema);

      // Store in bundles by hash
      storeBundle(bundleRes.hash, bundleRes.code, kind, inSchema, outSchema);

      // Create moduleRef pattern: steps.id or tools.id
      const moduleRef = `${kind}s.${id}`;
      ir.entries[moduleRef] = bundleRes.hash;
    }

    // Process entry hooks (onMessage, onCall, onInit, onTick)
    const hooks = ["onMessage", "onCall", "onInit", "onTick"];
    for (const hook of hooks) {
      if (agentConfig[hook]) {
        const bundleRes = await bundleHandler(
          entryFullPath,
          outDir,
          hook,
          false,
        );

        storeBundle(bundleRes.hash, bundleRes.code, "entry");
        ir.entries[hook] = bundleRes.hash;
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

        const routeKey = `${route.method}:${route.path}`;

        const bundleRes = await bundleHandler(
          filePath,
          outDir,
          exported[0],
          false,
        );

        const { schema: inSchema } = buildSchemaIR(route.inputSchema);

        storeBundle(bundleRes.hash, bundleRes.code, "route", inSchema);
        ir.entries[routeKey] = bundleRes.hash;
      }
    }

    // Process cron schedules
    if (Array.isArray(agentConfig.cron)) {
      ir.schedules = {};
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

        storeBundle(bundleRes.hash, bundleRes.code, "entry");
        ir.schedules[scheduleId] = {
          cron: schedule.expression,
          handlerHash: bundleRes.hash,
          timezone: schedule.timezone,
        };
      }
    }

    // Hash and write (hash excludes meta for stable identity)
    const irHash = calculateIRHash(ir);

    // Add metadata after hash calculation (meta is not part of identity)
    const sortedIR = sortKeys(ir);
    (sortedIR as any).meta = {
      kalpVersion: getSdkVersion(),
      buildTimestamp: Date.now(),
      nodeVersion: process.version,
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
