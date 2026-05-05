import { createJiti } from "jiti";
import { getRegistry, clearRegistry } from "@kalphq/sdk";
import { bundleHandler, ensureHandlersDir } from "./bundler";
import { buildSchemaIR, sortKeys } from "./ir-generator";
import { createHash } from "crypto";
import fs from "fs";
import path from "path";

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

export async function buildAgent(entryPath: string, outDir: string) {
  try {
    clearRegistry();

    // Normalize path for Windows
    const entryFullPath = path.resolve(entryPath);

    // Ensure handlers directory exists
    ensureHandlersDir(outDir);

    // Use import.meta.url to ensure correct resolution of workspace packages
    const jiti = createJiti(import.meta.url, { interopDefault: true });
    await jiti.import(entryFullPath);

    // After importing, the default export should be our agent config
    const mod = await jiti.import(entryFullPath);
    const agentConfig: any = (mod as any).default || mod;

    const registry = getRegistry();
    assertUniqueIds(registry);

    const ir: any = {
      agent: {
        id: agentConfig.id || "agent",
        name: agentConfig.name,
        description: agentConfig.description,
        hooks: {},
      },
      steps: {},
      tools: {},
      routes: {},
    };

    if (agentConfig.systemPrompt) {
      if (typeof agentConfig.systemPrompt === "function") {
        ir.agent.systemPrompt = {
          type: "function",
          dynamic: true,
          runtime: "required",
        };
      } else {
        ir.agent.systemPrompt = agentConfig.systemPrompt;
      }
    }

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
      const bundleRes = await bundleHandler(filePath, outDir, exported[0], true);

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
        const bundleRes = await bundleHandler(entryFullPath, outDir, hook, false);
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

        const bundleRes = await bundleHandler(filePath, outDir, exported[0], false);

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

    // Hash and write
    const sortedIR = sortKeys(ir);
    const irHash = createHash("sha256")
      .update(JSON.stringify(sortedIR))
      .digest("hex");
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
