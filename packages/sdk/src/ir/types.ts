/**
 * IR (Intermediate Representation) types for the Kalp compiler.
 *
 * @module
 */

/** Branded string type for IR node identifiers. */
export type IRNodeId = string & { readonly __brand: "IRNodeId" };

/**
 * The only two node kinds in the IR.
 * - `entry` - event-driven entrypoint (lifecycle, route)
 * - `handler` - opaque reference to a bundled handler module
 */
export type IRNodeKind = "entry" | "handler" | "schedule";

/** Base fields shared by all IR nodes. */
export interface IRNodeBase {
  kind: IRNodeKind;
  id: IRNodeId;
}

/**
 * Entry node - an event-driven entrypoint into the agent.
 * Maps an event name (e.g. "onMessage", "route:GET:/health") to a handler.
 */
export interface EntryIRNode extends IRNodeBase {
  kind: "entry";
  /** Event name that triggers this entry. */
  handler: string;
  /** HTTP method (only for route entries). */
  method?: string;
  /** URL path (only for route entries). */
  path?: string;
}

/** The type of handler a HandlerIRNode represents. */
export type HandlerType = "lifecycle" | "step" | "tool" | "route";

/**
 * Handler node - an opaque reference to a bundled handler module.
 * The IR does not know what the handler does internally; all effects
 * (ai, storage, actions, etc.) are intercepted at runtime.
 */
export interface HandlerIRNode extends IRNodeBase {
  kind: "handler";
  /** Reference to the bundled module (e.g. "onMessage", "steps.processQuery", "tools.search"). */
  moduleRef: string;
  /** Discriminator for the handler category. */
  handlerType: HandlerType;
  /** Optional JSON Schema for the handler's input. */
  inputSchema?: Record<string, unknown>;
  /** Optional JSON Schema for the handler's output. */
  outputSchema?: Record<string, unknown>;
}

/**
 * Schedule node - a cron-based scheduled entrypoint.
 */
export interface ScheduleIRNode extends IRNodeBase {
  kind: "schedule";
  cron: string;
  handler: IRNodeId;
  timezone?: string;
}

/** Union of all IR node types. */
export type IRNode = EntryIRNode | HandlerIRNode | ScheduleIRNode;

/**
 * The only two edge types in the IR.
 * - `sequential` - A completes, then B starts.
 * - `event` - An internal event triggers node B.
 */
export type IREdgeType = "sequential" | "event";

/**
 * A directed edge in the IR graph.
 */
export interface IREdge {
  from: IRNodeId;
  to: IRNodeId;
  type: IREdgeType;
  /** Optional descriptive tag. NEVER used as control-flow logic. */
  label?: string;
}

/**
 * Agent metadata for introspection (static compile-time info).
 * Runtime IDs (agentId, runId) are injected by the runtime, not stored here.
 */
export interface AgentMetadata {
  name: string;
  systemPrompt: string | { type: "function"; dynamic: true };
  metadata?: Record<string, unknown>;
}

/**
 * The complete IR graph - a minimal structural index of the agent.
 *
 * The IR is the sole compile-time artifact. It records which entrypoints
 * and handlers exist, and how they are structurally connected. All runtime
 * behavior (branches, loops, effects) is resolved by the Orchestration Reactor.
 */
export interface IRGraph {
  /** IR schema version. */
  version: 2;
  /** Agent identifier (generated server-side as ag_<ulid>). */
  agentId: string;
  /** Agent metadata for introspection. */
  agentMetadata: AgentMetadata;
  /** Map from event name to entry node ID. */
  entries: Record<string, IRNodeId>;
  /** All nodes keyed by ID. */
  nodes: Record<IRNodeId, IRNode>;
  /** Directed edges between nodes. */
  edges: IREdge[];
  /** O(1) lookup: moduleRef → handler node ID. Built by the compiler. */
  handlerIndex: Record<string, IRNodeId>;
  /** Scheduled cron jobs. */
  schedules?: Record<string, ScheduleIRNode>;
}
