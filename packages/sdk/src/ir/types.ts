/**
 * IR (Intermediate Representation) types for the Kalp compiler.
 *
 * The IR is a static manifest/registry. Flow control lives in the
 * compiled JS code; the IR just maps event names to handler bundles.
 *
 * @module
 */

/**
 * Agent metadata for introspection (static compile-time info).
 * Runtime IDs (agentId, runId) are injected by the runtime, not stored here.
 */
export interface AgentMetadata {
  /** Display name for the agent. */
  name: string;
  /** Human-friendly agent label for UIs. */
  label?: string;
  /** Optional description. */
  description?: string;
  /** Optional tags for filtering and grouping. */
  tags?: string[];
  /** Optional emitted events metadata. */
  emits?: Record<
    string,
    { type: "schema"; schema: unknown } | { type: "description"; description: string }
  >;
  /** System prompt or dynamic prompt function. */
  systemPrompt?: string | { type: "function"; dynamic: true };
  /** Additional metadata. */
  metadata?: Record<string, unknown>;
}

/**
 * A bundled handler module - the executable code for a handler.
 */
export interface HandlerBundle {
  /** The bundled JavaScript code. */
  code: string;
  /** Handler type discriminator. */
  type: "entry" | "step" | "tool" | "route";
  /** Optional JSON Schema for the handler's input. */
  inputSchema?: Record<string, unknown>;
  /** Optional JSON Schema for the handler's output. */
  outputSchema?: Record<string, unknown>;
}

/**
 * A scheduled cron job entry.
 */
export interface ScheduleEntry {
  /** Cron expression (e.g., "0 9 * * 1-5"). */
  cron: string;
  /** Handler hash to execute. */
  handlerHash: string;
  /** Optional timezone (e.g., "America/New_York"). */
  timezone?: string;
}

/**
 * The complete v3 IR manifest - a static registry of agent artifacts.
 *
 * The IR contains no graph edges or flow control - the user's JavaScript
 * code is the orchestrator. The runtime simply loads the appropriate
 * handler bundle when an event arrives.
 */
export interface IRGraph {
  /** IR schema version - always 3 for this format. */
  version: 3;
  /** Agent metadata for introspection. */
  metadata: AgentMetadata;
  /**
   * Map from event name to handler hash.
   * Examples:
   * - "onMessage" -> "abc123..."
   * - "onCall" -> "def456..."
   * - "GET:/health" -> "ghi789..."
   */
  entries: Record<string, string>;
  /**
   * Map from handler hash to bundled code.
   * The hash is SHA-256 of the bundled code for identity/validation.
   */
  bundles: Record<string, HandlerBundle>;
  /** Scheduled cron jobs keyed by schedule ID. */
  schedules?: Record<string, ScheduleEntry>;
}
