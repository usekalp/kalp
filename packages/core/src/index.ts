/**
 * @kalphq/core — Pure orchestration engine (infrastructure-agnostic).
 *
 * This barrel exports the engine, adapter interfaces, and primitives.
 * No implementations, no Cloudflare types, no runtime-specific code.
 *
 * For reactor instantiation, use `@kalphq/core/factory`:
 * ```ts
 * import { createReactor } from "@kalphq/core/factory";
 * ```
 *
 * @module
 */

// ────────────────────────────────────────────────────────────────────────────
// Engine
// ────────────────────────────────────────────────────────────────────────────

export { OrchestrationReactor } from "@/engine/reactor";
export { ExecutionLog } from "@/engine/execution-log";
export { buildHandlerContext } from "@/engine/context-builder";
export type { RuntimeProviders } from "@/engine/context-builder";

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

// ────────────────────────────────────────────────────────────────────────────
// Primitives
// ────────────────────────────────────────────────────────────────────────────

export { createAIPrimitive } from "@/engine/primitives/ai";
export type { AIProvider } from "@/engine/primitives/ai";
export { createStoragePrimitive } from "@/engine/primitives/storage";
export { createActionsPrimitive } from "@/engine/primitives/actions";
export type { DispatchAction } from "@/engine/primitives/actions";
export { createHttpPrimitive } from "@/engine/primitives/http";
