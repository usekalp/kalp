/**
 * Strongly-typed Effect Engine definitions.
 * 
 * Separates External Effects from Runtime Instructions, and defines exact
 * payload and result shapes for every possible effect, eliminating `unknown`.
 */

// ────────────────────────────────────────────────────────────────────────────
// Effect Maps (Strict Typings)
// ────────────────────────────────────────────────────────────────────────────

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
    payload: { prompt: string; classes: string[]; system?: string };
    result: string;
  };
  "storage.get": {
    payload: { key: string };
    result: unknown;
  };
  "storage.put": {
    payload: { key: string; value: unknown };
    result: void;
  };
  "storage.delete": {
    payload: { key: string };
    result: void;
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
    payload: { key?: string; content: string; metadata?: unknown };
    result: void;
  };
  "memory.list": {
    payload: { key?: string; limit?: number };
    result: unknown[];
  };
  "memory.summarize": {
    payload: { key?: string };
    result: string;
  };
  "vault.get": {
    payload: { key: string };
    result: string | null;
  };
  "mcp.call": {
    payload: { server: string; tool: string; args?: unknown };
    result: unknown;
  };
  "fetch": {
    payload: { url: string; method: string; body?: unknown; headers?: Record<string, string> };
    result: { status: number; body: unknown; headers: Record<string, string> };
  };
}

export interface InstructionEffectMap {
  "action.run": {
    payload: { target: string; input: unknown; idempotencyKey?: string };
    result: unknown;
  };
  "action.wait": {
    payload: { duration: string | number; wakeReason?: string };
    result: void;
  };
  "action.waitUntil": {
    payload: { until: number; wakeReason?: string };
    result: void;
  };
  "action.emit": {
    payload: { event: string; data: unknown };
    result: void;
  };
  "action.schedule": {
    payload: { at: number | string; data: unknown };
    result: void;
  };
  "action.ask": {
    payload: { prompt: string; schema?: unknown };
    result: unknown;
  };
  "action.approval": {
    payload: { reason: string; data?: unknown };
    result: { approved: boolean; data?: unknown };
  };
  "action.call": {
    payload: { contract: string; input: unknown };
    result: unknown;
  };
}

export type EffectMap = ExternalEffectMap & InstructionEffectMap;
export type EffectType = keyof EffectMap;
export type ExternalEffectType = keyof ExternalEffectMap;
export type InstructionEffectType = keyof InstructionEffectMap;

// ────────────────────────────────────────────────────────────────────────────
// Discriminated Unions
// ────────────────────────────────────────────────────────────────────────────

export interface Effect<T extends EffectType> {
  type: T;
  seq: number;
  payload: EffectMap[T]["payload"];
  executionId: string;
  traceId: string;
  threadId: string;
  timestamp: number;
}

export interface EffectResult<T extends EffectType = EffectType> {
  seq: number;
  result?: EffectMap[T]["result"];
  error?: { message: string; name: string; stack?: string };
}

// ────────────────────────────────────────────────────────────────────────────
// Resolver Interface
// ────────────────────────────────────────────────────────────────────────────

/**
 * Platform-provided resolver that executes External Effects.
 */
export interface EffectResolver {
  resolve<T extends ExternalEffectType>(effect: Effect<T>): Promise<EffectMap[T]["result"]>;
}
