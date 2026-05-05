/**
 * Primitive interfaces for the Kalp SDK.
 *
 * These are pure TypeScript contracts - implementations are injected by the runtime.
 *
 * @module
 */

export type {
  ModelMap,
  ProviderName,
  LocalModelId,
  KalpModelId,
  AIParams,
  KalpAI,
  KalpHistoryMessage,
} from "@/primitives/ai";

export type {
  StoragePutOptions,
  StorageTransaction,
  TransactionOptions,
  StoragePrimitive,
} from "@/primitives/storage";

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
