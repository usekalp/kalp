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
  EventLogBuffer,
  serializeError,
  deserializeError,
  type IntentEvent,
  type SerializedError,
} from "@/engine/event-log-buffer";
export {
  createActionProxy,
  type BundleExecutor,
  type EventPersister,
} from "@/engine/proxy-factory";
export { SuspensionException, type SuspensionState } from "@/engine/suspension";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export type {
  ExecutionEvent,
  ExecutionContext,
  UntrackedIOSource,
  RuntimeEvent,
  ExecutionTask,
  HandlerModule,
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
} from "@/adapters/interfaces";

import type { RuntimeProviders } from "@/engine/context-builder";
export type { RuntimeProviders };

// ────────────────────────────────────────────────────────────────────────────
// Primitives (for building custom proxies)
// ────────────────────────────────────────────────────────────────────────────

export { createAIPrimitive } from "@/engine/primitives/ai";
export type { AIProvider } from "@/engine/primitives/ai";
export { createStoragePrimitive } from "@/engine/primitives/storage";
export { createHttpPrimitive } from "@/engine/primitives/http";
export { createDatePrimitive } from "@/engine/primitives/date";
export { createMathPrimitive } from "@/engine/primitives/math";
export { createMcpPrimitive } from "@/engine/primitives/mcp";
