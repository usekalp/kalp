/**
 * @kalphq/core — Proxy-Listener Runtime.
 *
 * This barrel exports the runtime, adapter interfaces, and event sourcing
 * components. The architecture uses proxy-listener execution for
 * deterministic replay and native JS control flow.
 *
 * For runtime instantiation, use `@kalphq/core/factory`:
 * ```ts
 * import { createRuntime } from "@kalphq/core/factory";
 * ```
 *
 * @module
 */

// ────────────────────────────────────────────────────────────────────────────
// Runtime
// ────────────────────────────────────────────────────────────────────────────

export { KalpRuntime } from "@/engine/runtime";
export {
  ReplayLog,
  serializeError,
  type PersistedEffect,
  type SerializedError,
} from "./state/replay-log";
export { SuspensionException, type SuspensionState } from "@/engine/suspension";
export { createProxyContext } from "./effects/context";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export type {
  ExecutionEvent,
  ExecutionContext,
  UntrackedIOSource,
  RuntimeEvent,
  RuntimeEventType,
  ExecutionTask,
  HandlerModule,
  ContractValidation,
  Effect,
  EffectResult,
  EffectResolver,
} from "@/engine/types";

// ────────────────────────────────────────────────────────────────────────────
// Adapter interfaces (contracts only — no implementations)
// ────────────────────────────────────────────────────────────────────────────

export type {
  PersistenceAdapter,
  SchedulerAdapter,
  TransportAdapter,
  CrossThreadAdapter,
  StateStore,
  EventStore,
  IdempotencyStore,
  ThreadStore,
  AlarmPayload,
} from "@/adapters/interfaces";

// ────────────────────────────────────────────────────────────────────────────
// Schedule Manager
// ────────────────────────────────────────────────────────────────────────────

export { ScheduleManager } from "@/engine/schedule-manager";

// ────────────────────────────────────────────────────────────────────────────
// Replay Engine
// ────────────────────────────────────────────────────────────────────────────

export {
  validateReplay,
  detectSequenceKeyDrift,
  replayAndValidate,
  type ReplayResult,
} from "@/engine/replay-engine";
