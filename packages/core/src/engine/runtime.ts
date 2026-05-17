import type { BundleManifest, IRGraph, SchemaRegistry } from "@kalphq/sdk";
import type { RuntimeEvent } from "@/engine/types";
import type { PersistenceAdapter } from "@/adapters/interfaces";
import type { EffectResolver } from "@/effects/types";
import { ReplayLog } from "../state/replay-log";
import { createRootFrame, type ExecutionContext } from "../execution/frame";
import { calculateStartingSeq, resolveNodeId } from "./runtime-utils";
import {
  executeHandlerBundle,
  loadAgentState,
  AGENT_STATE_STORAGE_KEY,
  type RuntimeBundleLoader,
} from "./handler-executor";

const RUNTIME_CAPABILITIES: Record<string, number> = {
  "kalp/state": 1,
  "kalp/listeners": 1,
};

export class KalpRuntime {
  constructor(
    private readonly ir: IRGraph,
    private readonly schemas: SchemaRegistry,
    private readonly bundleManifest: BundleManifest,
    private readonly bundleLoader: RuntimeBundleLoader,
    private readonly persistence: PersistenceAdapter,
    private readonly resolver: EffectResolver,
  ) {
    if (ir.schemaVersion !== 3) {
      throw new Error(
        `IR incompatible (received schemaVersion ${String(ir.schemaVersion)}). Please recompile the agent with the current SDK/Compiler.`,
      );
    }

    if (!bundleManifest.targets.default) {
      throw new Error("Bundle manifest missing targets.default.");
    }

    if (bundleManifest.targets.default.abiVersion !== 1) {
      throw new Error(
        `Unsupported runtime ABI ${String(bundleManifest.targets.default.abiVersion)}. Expected ABI 1.`,
      );
    }

    for (const [requirement, version] of Object.entries(ir.requirements ?? {})) {
      const supported = RUNTIME_CAPABILITIES[requirement];
      if (supported === undefined || supported < version) {
        throw new Error(
          `Runtime capability mismatch for ${requirement}. Required v${version}, available v${supported ?? 0}.`,
        );
      }
    }
  }

  async handleEvent(event: RuntimeEvent): Promise<unknown> {
    const executionId = resolveExecutionId(event);
    const traceId = resolveTraceId(event);
    const log = await this.initReplayLog(event.threadId, traceId);

    const nodeId = resolveNodeId(event.type, this.ir);
    if (!nodeId) {
      throw new Error(`No handler found for event type: ${event.type}`);
    }

    const stateSchema = resolveSchema(this.ir.agent?.stateSchema, this.schemas);
    const state = applyStateDefaults(
      stateSchema,
      await loadAgentState(this.persistence),
    );
    const frame = this.bootstrapFrame(executionId, traceId, event.threadId, log);
    const result = await this.runHandler(nodeId, event, frame, log, state);

    await this.persistValidatedState(stateSchema, state, frame);
    return result;
  }

  private async initReplayLog(
    threadId: string | undefined,
    traceId: string,
  ): Promise<ReplayLog> {
    const log = new ReplayLog();
    await log.loadFromSQLite(this.persistence.events, { threadId, traceId });
    return log;
  }

  private bootstrapFrame(
    executionId: string,
    traceId: string,
    threadId: string | undefined,
    log: ReplayLog,
  ) {
    const execCtx: ExecutionContext = {
      traceId,
      threadId: threadId ?? "system",
      untrackedIOCount: 0,
      untrackedIOByType: { network: 0, timer: 0, fs: 0, unknown: 0 },
      hasUntrustedPlugins: false,
    };

    const startingSeq = calculateStartingSeq(log, executionId);
    return createRootFrame(execCtx, executionId, startingSeq);
  }

  private async runHandler(
    nodeId: string,
    event: RuntimeEvent,
    frame: ReturnType<typeof createRootFrame>,
    log: ReplayLog,
    state: Record<string, unknown>,
  ): Promise<unknown> {
    const result = await executeHandlerBundle(
      nodeId,
      event,
      frame,
      log,
      this.persistence,
      this.resolver,
      this.ir,
      this.schemas,
      this.bundleManifest,
      this.bundleLoader,
      state,
    );

    return result.value ?? { suspended: true, until: result.until, wakeReason: result.wakeReason };
  }

  private async persistValidatedState(
    stateSchema: Record<string, unknown> | undefined,
    state: Record<string, unknown>,
    frame: ReturnType<typeof createRootFrame>,
  ): Promise<void> {
    const errors = validateStateSchema(stateSchema, state, "state");
    if (errors.length > 0) {
      throw new Error(`State validation failed: ${errors.join("; ")}`);
    }

    await this.persistence.state.set(AGENT_STATE_STORAGE_KEY, state);
    await this.persistence.events.append({
      type: "state.write",
      key: AGENT_STATE_STORAGE_KEY,
      value: state,
      executionId: frame.executionId,
      traceId: frame.ctx.traceId,
      threadId: frame.ctx.threadId,
      timestamp: Date.now(),
    });
  }
}

function cloneDefaultValue<T>(value: T): T {
  if (value === undefined) {
    return value;
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

function resolveSchema(
  schemaId: string | undefined,
  schemas: SchemaRegistry,
): Record<string, unknown> | undefined {
  if (!schemaId) {
    return undefined;
  }

  return schemas[schemaId]?.schema as Record<string, unknown> | undefined;
}

function applyStateDefaults(
  schema: Record<string, unknown> | undefined,
  value: Record<string, unknown>,
): Record<string, unknown> {
  if (!schema) {
    return value;
  }

  const hydrated = applySchemaDefaults(schema, value);
  if (!hydrated || typeof hydrated !== "object" || Array.isArray(hydrated)) {
    return value;
  }

  return hydrated as Record<string, unknown>;
}

function applySchemaDefaults(
  schema: Record<string, unknown> | undefined,
  value: unknown,
): unknown {
  if (!schema) {
    return value;
  }

  const node = schema as any;

  if (value === undefined && "default" in node) {
    return cloneDefaultValue(node.default);
  }

  if (node.type === "object") {
    const base =
      value && typeof value === "object" && !Array.isArray(value)
        ? { ...(value as Record<string, unknown>) }
        : {};

    const properties = node.properties ?? {};
    for (const [key, childSchema] of Object.entries(properties)) {
      base[key] = applySchemaDefaults(
        childSchema as Record<string, unknown>,
        base[key],
      );
    }

    return base;
  }

  if (node.type === "array" && Array.isArray(value) && node.items) {
    return value.map((item) =>
      applySchemaDefaults(node.items as Record<string, unknown>, item),
    );
  }

  return value;
}

function resolveExecutionId(event: RuntimeEvent): string {
  if (event.type === "resume" && event.payload && typeof event.payload === "object") {
    return (event.payload as { executionId: string }).executionId;
  }
  return crypto.randomUUID();
}

function resolveTraceId(event: RuntimeEvent): string {
  if (event.traceId) return event.traceId;
  return crypto.randomUUID();
}

function validateStateSchema(
  schema: Record<string, unknown> | undefined,
  value: unknown,
  path: string,
): string[] {
  if (!schema) return [];
  const node = schema as any;
  const errors: string[] = [];

  if (node.enum) {
    if (!Array.isArray(node.enum) || !node.enum.includes(value)) {
      errors.push(`${path} must be one of ${JSON.stringify(node.enum)}`);
    }
    return errors;
  }

  switch (node.type) {
    case "object": {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        errors.push(`${path} must be an object`);
        return errors;
      }
      const record = value as Record<string, unknown>;
      const required = Array.isArray(node.required) ? node.required : [];
      const properties = node.properties ?? {};
      for (const key of required) {
        if (!(key in record)) {
          errors.push(`${path}.${key} is required`);
        }
      }
      for (const [key, childSchema] of Object.entries(properties)) {
        if (record[key] === undefined) continue;
        errors.push(...validateStateSchema(childSchema as Record<string, unknown>, record[key], `${path}.${key}`));
      }
      return errors;
    }
    case "array": {
      if (!Array.isArray(value)) {
        errors.push(`${path} must be an array`);
        return errors;
      }
      if (node.items) {
        value.forEach((item: unknown, index: number) => {
          errors.push(
            ...validateStateSchema(node.items as Record<string, unknown>, item, `${path}[${index}]`),
          );
        });
      }
      return errors;
    }
    case "string":
      if (typeof value !== "string") errors.push(`${path} must be a string`);
      return errors;
    case "number":
    case "integer":
      if (typeof value !== "number") errors.push(`${path} must be a number`);
      return errors;
    case "boolean":
      if (typeof value !== "boolean") errors.push(`${path} must be a boolean`);
      return errors;
    case "null":
      if (value !== null) errors.push(`${path} must be null`);
      return errors;
    default:
      return errors;
  }
}
