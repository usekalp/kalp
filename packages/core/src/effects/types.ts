/**
 * Strongly-typed Effect Engine definitions.
 */

/**
 * Maps external effect type strings to their payload and result types.
 * External effects are resolved by the runtime environment (e.g. storage, AI, vault, MCP).
 */
export interface ExternalEffectMap {
  "ai.generate": {
    payload: { prompt: string; schema?: unknown; system?: string };
    result: { text: string; parsed?: unknown };
  };
  "ai.stream": {
    payload: { prompt: string; schema?: unknown; system?: string };
    result: string;
  };
  "ai.classify": {
    payload: { prompt: string; classes: string[]; system?: string; model?: string; confidenceThreshold?: number };
    result: string;
  };
  "storage.get": {
    payload: { key: string };
    result: unknown;
  };
  "storage.put": {
    payload: { key: string; value: unknown; options?: unknown };
    result: void;
  };
  "storage.delete": {
    payload: { key: string };
    result: void;
  };
  "storage.increment": {
    payload: { key: string; amount?: number };
    result: number;
  };
  "storage.list": {
    payload: { prefix?: string };
    result: string[];
  };
  "storage.batch": {
    payload: {
      operations: Array<
        | { op: "put"; key: string; value: unknown }
        | { op: "delete"; key: string }
        | { op: "increment"; key: string; amount: number }
        | { op: "cas"; key: string; expected: unknown; next: unknown }
      >;
    };
    result: void;
  };
  "memory.append": {
    payload: { key?: string; content: string; role?: string; metadata?: unknown };
    result: void;
  };
  "memory.list": {
    payload: { key?: string; limit?: number; cursor?: string; order?: "asc" | "desc" };
    result: { items: unknown[]; nextCursor?: string };
  };
  "memory.summarize": {
    payload: { key?: string };
    result: string;
  };
  "vault.get": {
    payload: { key: string };
    result: string;
  };
  "mcp.call": {
    payload: { server: string; tool: string; args?: unknown };
    result: unknown;
  };
  fetch: {
    payload: { url: string; method: string; body?: unknown; headers?: Record<string, string> };
    result: { status: number; body: unknown; headers: Record<string, string> };
  };
}

/**
 * Maps instruction effect type strings to their payload and result types.
 * Instruction effects control agent workflow (e.g. scheduling, approvals, sleep).
 */
export interface InstructionEffectMap {
  "action.run": {
    payload: { target: string; input: unknown; idempotencyKey?: string };
    result: unknown;
  };
  "action.sleep": {
    payload: { duration: { milliseconds?: number; seconds?: number; minutes?: number; hours?: number; days?: number }; wakeReason?: string };
    result: void;
  };
  "action.waitUntil": {
    payload: { until: number; wakeReason?: string };
    result: void;
  };
  "action.dispatch": {
    payload: { listener: string; data: unknown; options?: unknown };
    result: { eventId: string };
  };
  "action.schedule.cancel": {
    payload: { id: string };
    result: void;
  };
  "action.schedule.reschedule": {
    payload: { id: string; when: number };
    result: void;
  };
  "action.schedule.status": {
    payload: { id: string };
    result: string;
  };
  "action.schedule": {
    payload: { at: number | string; data: unknown };
    result: { id: string };
  };
  "action.ask": {
    payload: { prompt: string; schema?: unknown; options?: unknown };
    result: unknown;
  };
  "action.approval": {
    payload: { reason: string; data?: unknown; options?: unknown };
    result: { approved: boolean; data?: unknown } | boolean;
  };
  "action.call": {
    payload: { contract: string; input: unknown };
    result: unknown;
  };
}

/**
 * Combined map of all available effects, merging external and instruction effects.
 */
export type EffectMap = ExternalEffectMap & InstructionEffectMap;

/**
 * Union of all valid effect type strings.
 */
export type EffectType = keyof EffectMap;

/**
 * Union of all external effect type strings.
 */
export type ExternalEffectType = keyof ExternalEffectMap;

/**
 * Union of all instruction effect type strings.
 */
export type InstructionEffectType = keyof InstructionEffectMap;

/**
 * Runtime descriptor for a single effect invocation, including its type, payload, and execution context.
 */
export interface Effect<T extends EffectType> {
  type: T;
  seq: number;
  payload: EffectMap[T]["payload"];
  executionId: string;
  traceId: string;
  threadId: string;
  timestamp: number;
}

/**
 * Result of an effect execution, containing either the resolved value or a serialized error.
 */
export interface EffectResult<T extends EffectType = EffectType> {
  seq: number;
  result?: EffectMap[T]["result"];
  error?: { message: string; name: string; stack?: string };
}

/**
 * Resolves an effect to its typed result. Implemented by the runtime to handle effect execution.
 */
export interface EffectResolver {
  resolve<T extends EffectType>(effect: Effect<T>): Promise<EffectMap[T]["result"]>;
}
