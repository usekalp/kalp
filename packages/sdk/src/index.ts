export { z } from "zod";

// ============================================================================
// Identity Module
// ============================================================================

// Branded types
export type {
  UserId,
  AgentId,
  ThreadId,
  ExecutionId,
  TraceId,
} from "@/identity";

// Type constructors (runtime functions)
export {
  asUserId,
  asAgentId,
  asThreadId,
  asExecutionId,
  asTraceId,
} from "@/identity";

// Identity configuration & auth strategies
export type {
  IdentityConfig,
  JwtPayload,
  JwksStrategy,
  SymmetricStrategy,
  ApiKeyStrategy,
  AuthStrategy,
} from "@/identity";

// ============================================================================
// Contracts Module (RPC)
// ============================================================================

export type { AgentContract } from "@/contracts";
export { defineContract } from "@/contracts";

// ============================================================================
// Primitives Module
// ============================================================================

export type {
  // AI
  AIProvider,
  ProviderModelMap,
  ConfiguredModel,
  ProviderName,
  KalpModelId,
  AIParams,
  KalpHistoryMessage,
  // Memory
  MemoryListParams,
  MemoryListResult,
  // Vault
  SecretsRegistry,
  RegisteredSecrets,
  SecretKey,
  // Logging
  KalpLog,
  LogLevel,
  KalpAI,
  KalpMemory,
  KalpVault,
  StoragePrimitive,
  // Storage
  StoragePutOptions,
  StorageTransaction,
  TransactionOptions,
  AgentIntrospection,
  // Deterministic Primitives
  KalpDate,
  TimezoneFormatter,
  KalpMath,
  KalpMcp,
} from "@/primitives";

// ============================================================================
// Actions Module
// ============================================================================

export type {
  WakeReason,
  AskOptions,
  EmitOptions,
  KalpActions,
  TypedActions,
} from "@/actions";

// ============================================================================
// Nodes Module
// ============================================================================

export type {
  NodeKind,
  Node,
  Step,
  Tool,
  AnyStep,
  AnyTool,
  Route,
  StepConfig,
  ToolConfig,
  RouteConfig,
  ExecutableNode,
  RegistryNode,
} from "@/nodes";

// ============================================================================
// Context Module
// ============================================================================

export type {
  InferNodes,
  KalpAuth,
  HandlerContext,
  KalpCtx,
  AgentContext,
  TypedAgentContext,
  AgentMessage,
  AgentResponse,
} from "@/context";

// ============================================================================
// IR Module
// ============================================================================

export type {
  AgentMetadata,
  HandlerBundle,
  ScheduleEntry,
  IRGraph,
} from "@/ir";

// ============================================================================
// Utils Module
// ============================================================================

export type { InputOf, OutputOf } from "@/utils";

// ============================================================================
// Agent Definition
// ============================================================================

export { defineAgent } from "@/agent";

// ============================================================================
// Factory Functions (Definitions)
// ============================================================================

export { defineStep, defineTool } from "@/definitions";
export { defineRoute } from "@/definitions";
export { defineConfig } from "@/project";
export type { KalpProjectConfig, McpServerConfig } from "@/project";

// ============================================================================
// Registry
// ============================================================================

export { getRegistry, clearRegistry } from "@/registry";
export type { RegistryEntry } from "@/registry";

// ============================================================================
// Errors
// ============================================================================

export {
  KalpError,
  KalpValidationError,
  KalpAuthError,
  KalpNotFoundError,
  isKalpError,
  normalizeKalpError,
} from "@/errors";
