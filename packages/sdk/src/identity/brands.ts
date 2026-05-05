/**
 * Branded types for Kalp identity system.
 *
 * These prevent accidental mixing of different ID types at compile time.
 * For example, you cannot pass a UserId where an AgentId is expected.
 *
 * @module
 */

/** Unique identifier for users */
export type UserId = string & { readonly __brand: "UserId" };

/** Unique identifier for agents */
export type AgentId = string & { readonly __brand: "AgentId" };

/** Unique identifier for threads (actor instances) */
export type ThreadId = string & { readonly __brand: "ThreadId" };

/** Unique identifier for executions (single handler invocation) */
export type ExecutionId = string & { readonly __brand: "ExecutionId" };

/** Unique identifier for traces (single external stimulus) */
export type TraceId = string & { readonly __brand: "TraceId" };

/**
 * Creates a UserId from a string.
 * Runtime validation should be performed in production code.
 *
 * @param id - The string identifier.
 * @returns A branded UserId.
 */
export function asUserId(id: string): UserId {
  return id as UserId;
}

/**
 * Creates an AgentId from a string.
 *
 * @param id - The string identifier.
 * @returns A branded AgentId.
 */
export function asAgentId(id: string): AgentId {
  return id as AgentId;
}

/**
 * Creates a ThreadId from a string.
 *
 * @param id - The string identifier.
 * @returns A branded ThreadId.
 */
export function asThreadId(id: string): ThreadId {
  return id as ThreadId;
}

/**
 * Creates an ExecutionId from a string.
 *
 * @param id - The string identifier.
 * @returns A branded ExecutionId.
 */
export function asExecutionId(id: string): ExecutionId {
  return id as ExecutionId;
}

/**
 * Creates a TraceId from a string.
 *
 * @param id - The string identifier.
 * @returns A branded TraceId.
 */
export function asTraceId(id: string): TraceId {
  return id as TraceId;
}
