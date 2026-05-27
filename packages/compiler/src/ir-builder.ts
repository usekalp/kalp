import type { BundleNodeBinding, NodeDescriptor, IRNodeKind } from "@kalphq/sdk";
import { bundleHandler } from "./bundler";
import { assertCronExpression, isSdkInternalPath, normalizeStableRouteName } from "./utils";
import type { HandlerSourceAnalysis } from "./tracing/types";

export interface DebugNodeMetadata {
  absoluteFile: string;
  relativeModule: string;
  export: string;
  line?: number;
  column?: number;
  sourceMap?: string;
}

export interface CompilerContext {
  outDir: string;
  entryFullPath: string;
  agentName: string;
  getModuleExports: (filePath: string) => Promise<any>;
  registerSchema: (schema?: unknown) => string | undefined;
  registerNode: (node: {
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
  }) => Promise<void>;
  stableNames: Set<string>;
  sourceAnalysis: HandlerSourceAnalysis[];
}

async function resolveExportName(
  filePath: string,
  internalId: symbol | undefined,
  ctx: CompilerContext,
): Promise<string | undefined> {
  if (!filePath || !internalId || isSdkInternalPath(filePath)) {
    return undefined;
  }

  const modExports = await ctx.getModuleExports(filePath);
  const exported = Object.entries(modExports).find(
    ([, value]) => (value as any)?.__internalId === internalId,
  );

  return exported?.[0];
}

function createHookStableName(type: "init" | "tick" | "message", index: number): string {
  if (type === "message") {
    return "hook.message";
  }

  return `hook.${type}.${index}`;
}

export async function processRegistryNodes(registry: any, ctx: CompilerContext) {
  for (const [, entry] of registry.entries()) {
    const { kind, id, ref } = entry;
    const node = ref as any;
    const filePath = node.__filePath;

    if (!filePath) {
      throw new Error(`Missing filePath for node ${id}`);
    }

    const exportName = await resolveExportName(filePath, node.__internalId, ctx);
    if (!exportName) {
      throw new Error(`Cannot resolve handler export for node "${id}" in ${filePath}`);
    }

    const inputSchema = ctx.registerSchema(node.inputSchema);

    if (kind === "tool") {
      await ctx.registerNode({
        kind: "tool",
        name: id,
        stableName: `tool.${id.replace(/[^a-zA-Z0-9._-]+/g, "-").toLowerCase()}`,
        inputSchema,
        filePath,
        exportName,
      });
      continue;
    }

    await ctx.registerNode({
      kind: "listener",
      name: id,
      stableName: `listener.${id.replace(/[^a-zA-Z0-9._-]+/g, "-").toLowerCase()}`,
      inputSchema,
      outputSchema: ctx.registerSchema(node.outputSchema),
      trigger: { type: "listener", event: id },
      listener: { event: id },
      filePath,
      exportName,
    });
  }
}

export async function processHooks(agentConfig: any, ctx: CompilerContext) {
  const hooks = Array.isArray(agentConfig.hooks) ? agentConfig.hooks : [];
  const messageHooks = hooks.filter((hook: any) => hook?.type === "message");
  if (messageHooks.length > 1) {
    throw new Error(`Agent "${agentConfig.name}" can declare only one message hook.`);
  }

  const lifecycleCounts: Record<"init" | "tick", number> = { init: 0, tick: 0 };

  for (let i = 0; i < hooks.length; i++) {
    const hook = hooks[i];
    if (!hook?.type) continue;

    const exportName =
      (hook.__filePath && (await resolveExportName(hook.__filePath, hook.__internalId, ctx))) ||
      `hooks[${i}]`;
    const filePath = exportName === `hooks[${i}]` ? ctx.entryFullPath : hook.__filePath;

    if (hook.type === "message") {
      await ctx.registerNode({
        kind: "message",
        stableName: createHookStableName("message", 0),
        trigger: { type: "message" },
        filePath,
        exportName,
      });
      continue;
    }

    const hookType = hook.type as "init" | "tick";
    const idx = lifecycleCounts[hookType]++;
    await ctx.registerNode({
      kind: hookType,
      stableName: createHookStableName(hookType, idx),
      trigger: { type: "lifecycle", event: hookType },
      filePath,
      exportName,
    });
  }
}

export async function processContracts(agentConfig: any, ctx: CompilerContext) {
  const contracts = Array.isArray(agentConfig.contracts) ? agentConfig.contracts : [];
  for (let i = 0; i < contracts.length; i++) {
    const contract = contracts[i];
    const exportName =
      (contract.__filePath &&
        (await resolveExportName(contract.__filePath, contract.__internalId, ctx))) ||
      `contracts[${i}]`;
    const filePath = exportName === `contracts[${i}]` ? ctx.entryFullPath : contract.__filePath;

    await ctx.registerNode({
      kind: "contract",
      name: contract.name,
      stableName: `contract.${contract.name.replace(/[^a-zA-Z0-9._-]+/g, "-").toLowerCase()}`,
      inputSchema: ctx.registerSchema(contract.inputSchema),
      outputSchema: ctx.registerSchema(contract.outputSchema),
      trigger: { type: "rpc", contractName: contract.name },
      filePath,
      exportName,
    });
  }
}

export async function processRoutes(agentConfig: any, ctx: CompilerContext) {
  if (!Array.isArray(agentConfig.routes)) return;

  for (let i = 0; i < agentConfig.routes.length; i++) {
    const route = agentConfig.routes[i];
    const exportName =
      (route.__filePath && (await resolveExportName(route.__filePath, route.__internalId, ctx))) ||
      `routes[${i}]`;
    const filePath = exportName === `routes[${i}]` ? ctx.entryFullPath : route.__filePath;

    await ctx.registerNode({
      kind: "route",
      name: route.id ?? `${route.method}:${route.path}`,
      stableName: normalizeStableRouteName(route.method, route.path, ctx.stableNames),
      inputSchema: ctx.registerSchema(route.inputSchema),
      outputSchema: ctx.registerSchema(route.outputSchema),
      trigger: { type: "http", method: route.method, path: route.path },
      http: {
        method: route.method,
        path: route.path,
        ...(typeof route.skipAuth === "boolean" && { skipAuth: route.skipAuth }),
      },
      filePath,
      exportName,
    });
  }
}

export async function processCron(agentConfig: any, ctx: CompilerContext) {
  if (!Array.isArray(agentConfig.cron)) return;

  for (let i = 0; i < agentConfig.cron.length; i++) {
    const schedule = agentConfig.cron[i];
    assertCronExpression(agentConfig.name, schedule.expression, i);

    const exportName =
      (schedule.__filePath &&
        (await resolveExportName(schedule.__filePath, schedule.__internalId, ctx))) ||
      `cron[${i}]`;
    const filePath = exportName === `cron[${i}]` ? ctx.entryFullPath : schedule.__filePath;

    await ctx.registerNode({
      kind: "cron",
      stableName: `cron.${i}`,
      trigger: { type: "schedule", scheduleId: `cron:${i}` },
      schedule: {
        expression: schedule.expression,
        timezone: schedule.timezone,
      },
      filePath,
      exportName,
    });
  }
}

export async function createBundleBinding(
  filePath: string,
  bundlesDir: string,
  exportName: string,
): Promise<BundleNodeBinding> {
  const bundleRes = await bundleHandler(filePath, bundlesDir, exportName);
  return {
    bundle: bundleRes.hash,
    file: bundleRes.file,
    size: bundleRes.size,
    format: bundleRes.format,
    entry: bundleRes.entry,
    sha256: bundleRes.sha256,
  };
}
