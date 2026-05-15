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

export type { AgentContract, EmitsOf } from "@/contracts";
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
  McpRegistry,
} from "@/primitives";

// ============================================================================
// Schedule Module
// ============================================================================

export {
  cron,
  everyDayAt,
  everyWeekdayAt,
  everyXMinutes,
  everyMinute,
  everyHour,
  everySixHours,
  everyDayAtMidnight,
  everyDayAtNoon,
  everyDayAt12Pm,
  everyWeekdayAt9Am,
  everySundayAt3Am,
  IANA_TIMEZONES,
} from "@/schedule";

export type {
  CronExpression,
  CronSchedule,
  CronHour,
  CronMinute,
  IanaTimezone,
} from "@/schedule";

// ============================================================================
// Actions Module
// ============================================================================

export type {
  WakeReason,
  AskOptions,
  EmitOptions,
  InferEmitPayload,
  TypedEmit,
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
  InferAgentEmits,
  KalpAuth,
  KalpContext,
  TypedKalpContext,
  AgentMessage,
  AgentResponse,
} from "@/context";

// ============================================================================
// IR Module
// ============================================================================

export type {
  NodeDescriptor,
  TriggerDescriptor,
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
export type { AgentConfigBase } from "@/agent";
export { defineListener } from "@/listeners";
export type { Listener } from "@/listeners";

// ============================================================================
// Factory Functions (Definitions)
// ============================================================================

export { defineStep, defineTool } from "@/definitions";
export { defineRoute } from "@/definitions";
export {
  defineConfig,
  normalizeMcpServer,
  collectMcpSecretRequirements,
  extractEnvName,
  env,
} from "@/project";
export type {
  KalpProjectConfig,
  McpServerInput,
  NormalizedMcpServer,
  KalpAIEnvironment,
} from "@/project";

// ============================================================================
// Registry
// ============================================================================

export { getRegistry, clearRegistry, bindContract } from "@/registry";
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
