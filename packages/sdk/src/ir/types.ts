/**
 * IR (Intermediate Representation) types for the Kalp compiler.
 *
 * The IR is a static manifest/registry. Flow control lives in the
 * compiled JS code; the IR just maps event names to handler bundles.
 *
 * @module
 */

/**
 * Trigger that activates a node.
 */
export type TriggerDescriptor =
  | { type: "lifecycle"; event: "init" | "tick" }
  | { type: "message" }
  | { type: "rpc" }
  | { type: "http"; method: string; path: string }
  | { type: "schedule"; scheduleId: string }
  | { type: "listener"; sourceAgentId: string; event: string };

/**
 * Descriptor for an executable node in IR v2.
 */
export interface NodeDescriptor {
  /** What this node IS — determines how Core calls it */
  kind:
    | "init" // fn(ctx)
    | "tick" // fn(ctx)
    | "message" // fn(message, ctx)
    | "call" // fn(input, ctx)
    | "route" // fn({req, res, body, ctx})
    | "listener" // fn(payload, ctx)
    | "cron" // fn(ctx)
    | "step" // fn(input, ctx) — via actions.run
    | "tool"; // fn(input, ctx) — via actions.run

  /** Content-addressed bundle hash → bundles[hash] */
  bundle: string;

  /** What activates this node (absent for step/tool — activated via actions.run) */
  trigger?: TriggerDescriptor;

  /** Input/output schemas (JSON Schema draft-07) */
  contract?: {
    input?: Record<string, unknown>;
    output?: Record<string, unknown>;
  };

  /** Agent-level event emission declarations */
  emits?: Record<
    string,
    {
      schema?: Record<string, unknown>;
      description?: string;
    }
  >;

  /** Listener wiring */
  source?: {
    agentId: string;
    event: string;
  };

  /** Route/auth metadata */
  http?: {
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    path: string;
    skipAuth?: boolean;
  };

  /** Cron metadata */
  schedule?: {
    expression: string;
    timezone?: string;
  };

  /** Source location for diagnostics */
  sourceLocation?: {
    file: string;
    exportName: string;
  };
}

/**
 * IR Manifest - Effect Engine Architecture
 */
export interface IRGraph {
  version: 2;

  /** Agent identity and metadata */
  agent: {
    name: string;
    label?: string;
    description?: string;
    tags?: string[];
    skipAuth?: boolean;
    systemPrompt?: string | { dynamic: true };
  };

  /**
   * Every executable unit in the agent.
   * Key = stable semantic ID (e.g. "hook:init", "step:create_ticket", "route:POST:/intake")
   */
  nodes: Record<string, NodeDescriptor>;

  /** Content-addressed handler code, keyed by SHA-256 hash */
  bundles: Record<
    string,
    {
      code: string;
      hash: string;
    }
  >;

  /** Build metadata (excluded from identity hash) */
  meta: {
    sdkVersion: string;
    compilerVersion: string;
    buildTimestamp: number;
  };

  /** Deterministic identity hash (excludes meta) */
  irHash: string;
}
