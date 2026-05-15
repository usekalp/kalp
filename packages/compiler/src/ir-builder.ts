import { bundleHandler } from "./bundler";
import { buildSchemaIR } from "./ir-generator";
import { isSdkInternalPath, assertCronExpression } from "./utils";

export interface CompilerContext {
  ir: any;
  outDir: string;
  agentEmits: any;
  entryFullPath: string;
  jiti: any;
  fileExportsCache: Map<string, any>;
  storeBundle: (hash: string, code: string) => void;
  getModuleExports: (filePath: string) => Promise<any>;
}

export async function processRegistrySteps(
  registry: any,
  ctx: CompilerContext
) {
  for (const [_key, entry] of registry.entries()) {
    const { kind, id, ref } = entry;
    const node = ref as any;
    const internalId = node.__internalId;
    const filePath = node.__filePath;

    if (!filePath) throw new Error(`Missing filePath for node ${id}`);

    const modExports = await ctx.getModuleExports(filePath);
    const exported = Object.entries(modExports).find(
      ([_, value]) => (value as any)?.__internalId === internalId,
    );

    if (!exported) {
      throw new Error(`Cannot resolve handler export for node "${id}" in ${filePath}`);
    }

    const bundleRes = await bundleHandler(filePath, ctx.outDir, exported[0], true);
    const { schema: inSchema } = buildSchemaIR(node.inputSchema);
    const { schema: outSchema } = buildSchemaIR(node.outputSchema);

    ctx.storeBundle(bundleRes.hash, bundleRes.code);

    const stableId = `${kind}:${id}`;
    ctx.ir.nodes[stableId] = {
      kind,
      bundle: bundleRes.hash,
      contract: {
        ...(inSchema && { input: inSchema }),
        ...(outSchema && { output: outSchema }),
      },
      emits: ctx.agentEmits,
      sourceLocation: {
        file: filePath,
        exportName: exported[0],
      },
    };
  }
}

export async function processHooks(agentConfig: any, ctx: CompilerContext) {
  const hookToKind: Record<string, "message" | "call" | "init" | "tick"> = {
    onMessage: "message",
    onCall: "call",
    onInit: "init",
    onTick: "tick"
  };

  for (const [hook, kind] of Object.entries(hookToKind)) {
    if (agentConfig[hook]) {
      const bundleRes = await bundleHandler(ctx.entryFullPath, ctx.outDir, hook, false);
      ctx.storeBundle(bundleRes.hash, bundleRes.code);
      const stableId = `hook:${kind}`;
      ctx.ir.nodes[stableId] = {
        kind,
        bundle: bundleRes.hash,
        trigger: { type: kind === "init" || kind === "tick" ? "lifecycle" : kind, ...(kind === "init" || kind === "tick" ? { event: kind } : {}) },
        emits: ctx.agentEmits,
        sourceLocation: { file: ctx.entryFullPath, exportName: hook },
      };
    }
  }
}

export async function processRoutes(agentConfig: any, ctx: CompilerContext) {
  if (!Array.isArray(agentConfig.routes)) return;

  for (const route of agentConfig.routes) {
    const internalId = route.__internalId;
    const filePath = route.__filePath;

    if (!filePath) throw new Error(`Missing filePath for route ${route.id || route.path}`);

    const modExports = await ctx.getModuleExports(filePath);
    const exported = Object.entries(modExports).find(
      ([_, value]) => (value as any)?.__internalId === internalId,
    );

    if (!exported) {
      throw new Error(`Cannot resolve handler export for route in ${filePath}`);
    }

    const bundleRes = await bundleHandler(filePath, ctx.outDir, exported[0], false);
    const { schema: inSchema } = buildSchemaIR(route.inputSchema);

    ctx.storeBundle(bundleRes.hash, bundleRes.code);
    const stableId = `route:${route.method}:${route.path}`;
    ctx.ir.nodes[stableId] = {
      kind: "route",
      bundle: bundleRes.hash,
      trigger: { type: "http", method: route.method, path: route.path },
      contract: { ...(inSchema && { input: inSchema }) },
      http: {
        method: route.method,
        path: route.path,
        ...(typeof route.skipAuth === "boolean" && { skipAuth: route.skipAuth })
      },
      emits: ctx.agentEmits,
      sourceLocation: { file: filePath, exportName: exported[0] },
    };
  }
}

export async function processListeners(agentConfig: any, ctx: CompilerContext) {
  if (!Array.isArray(agentConfig.listeners)) return;

  for (let i = 0; i < agentConfig.listeners.length; i++) {
    const listener = agentConfig.listeners[i];
    const internalId = listener.__internalId;
    const filePath = listener.__filePath;
    const targetFilePath = filePath ?? ctx.entryFullPath;
    let exportName = `listeners[${i}]`;

    if (filePath && internalId && !isSdkInternalPath(filePath)) {
      const modExports = await ctx.getModuleExports(filePath);
      const exported = Object.entries(modExports).find(
        ([_, value]) => (value as any)?.__internalId === internalId,
      );
      if (!exported) {
        exportName = `listeners[${i}]`;
        const fallbackFilePath = ctx.entryFullPath;
        const stableId = `listener:${listener.source.agentId}:${String(listener.event)}:${i}`;
        const bundleRes = await bundleHandler(fallbackFilePath, ctx.outDir, exportName, false);
        ctx.storeBundle(bundleRes.hash, bundleRes.code);
        ctx.ir.nodes[stableId] = {
          kind: "listener",
          bundle: bundleRes.hash,
          trigger: { type: "listener", sourceAgentId: listener.source.agentId, event: String(listener.event) },
          source: { agentId: listener.source.agentId, event: String(listener.event) },
          emits: ctx.agentEmits,
          sourceLocation: { file: fallbackFilePath, exportName },
        };
        continue;
      }
      exportName = exported[0];
    }

    const stableId = `listener:${listener.source.agentId}:${String(listener.event)}:${i}`;
    const bundleRes = await bundleHandler(targetFilePath, ctx.outDir, exportName, false);
    ctx.storeBundle(bundleRes.hash, bundleRes.code);
    ctx.ir.nodes[stableId] = {
      kind: "listener",
      bundle: bundleRes.hash,
      trigger: { type: "listener", sourceAgentId: listener.source.agentId, event: String(listener.event) },
      source: { agentId: listener.source.agentId, event: String(listener.event) },
      emits: ctx.agentEmits,
      sourceLocation: { file: targetFilePath, exportName },
    };
  }
}

export async function processCron(agentConfig: any, ctx: CompilerContext) {
  if (!Array.isArray(agentConfig.cron)) return;

  for (let i = 0; i < agentConfig.cron.length; i++) {
    const schedule = agentConfig.cron[i];
    const stableId = `cron:${i}`;
    assertCronExpression(agentConfig.name, schedule.expression, i);

    const bundleRes = await bundleHandler(ctx.entryFullPath, ctx.outDir, `cron[${i}]`, false);
    ctx.storeBundle(bundleRes.hash, bundleRes.code);
    ctx.ir.nodes[stableId] = {
      kind: "cron",
      bundle: bundleRes.hash,
      trigger: { type: "schedule", scheduleId: stableId },
      schedule: {
        expression: schedule.expression,
        timezone: schedule.timezone,
      },
      emits: ctx.agentEmits,
      sourceLocation: { file: ctx.entryFullPath, exportName: `cron[${i}]` },
    };
  }
}
