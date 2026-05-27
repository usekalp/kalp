/**
 * Primitive interfaces for the Kalp SDK.
 *
 * These are pure TypeScript contracts - implementations are injected by the runtime.
 *
 * @module
 */

export type {
  KalpAI,
  KalpAITierRegistry,
  ModelTier,
  KnownTier,
} from "@/primitives/ai";

export type { KalpCache } from "@/primitives/cache";

export type { LogLevel, KalpLog } from "@/primitives/log";

export type {
  MemoryListParams,
  MemoryListResult,
  KalpMemory,
} from "@/primitives/memory";

export type {
  SecretsRegistry,
  RegisteredSecrets,
  SecretKey,
  KalpVault,
} from "@/primitives/auth";

export type { KalpMcp, McpRegistry } from "@/primitives/mcp";

export type { AgentIntrospection } from "@/primitives/agent-meta";

export type { KalpDate, TimezoneFormatter } from "@/primitives/date";

export type { KalpMath } from "@/primitives/math";

export type {
  Duration,
} from "@/primitives/duration";

export {
  toMs,
  normalizeDuration,
  ms,
  seconds,
  minutes,
  hours,
  days,
} from "@/primitives/duration";

export type { KalpTime, TimezoneFormatter as TimeTimezoneFormatter } from "@/primitives/time";

export { assertTimestampInput } from "@/primitives/time";

export type {
  KalpHistory,
  KalpHistoryMessage,
  HistoryListOptions,
} from "@/primitives/history";
