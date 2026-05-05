/**
 * Identity module for Kalp branded types and authentication strategies.
 *
 * @module
 */

// Branded types
export type {
  UserId,
  AgentId,
  ThreadId,
  ExecutionId,
  TraceId,
} from "@/identity/brands";

// Type constructors (runtime functions)
export {
  asUserId,
  asAgentId,
  asThreadId,
  asExecutionId,
  asTraceId,
} from "@/identity/brands";

// Identity configuration
export type { IdentityConfig } from "@/identity/auth";

// Authentication strategies
export type {
  JwtPayload,
  JwksStrategy,
  SymmetricStrategy,
  ApiKeyStrategy,
  AuthStrategy,
} from "@/identity/auth";
