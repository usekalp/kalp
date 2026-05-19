/**
 * Shared engine type definitions.
 *
 * Central re-export point for all runtime types consumed across the core
 * package: execution events, dispatch envelopes, runtime stimuli, internal
 * tasks, and the full effect-type hierarchy.
 *
 * @module
 */

/** Best-effort categories of IO that the effect system cannot intercept. */
export type { UntrackedIOSource } from "./events";

/** All structured events emitted during agent execution — the system's source of truth. */
export type { ExecutionEvent } from "./events";

/**
 * Envelope propagated across asynchronous event dispatch boundaries.
 * Preserves causal traceability when an emit wakes listener handlers.
 */
export type { EventDispatchEnvelope } from "./envelope";

/** External stimulus entering the reactor (onMessage, onTick, resume, etc.). */
export type { RuntimeEvent, RuntimeEventType } from "./runtime";

/** Internal work items in the reactor queue and their associated types. */
export type { ExecutionTask, ContractValidation, HandlerModule } from "./tasks";

/**
 * Strongly-typed effect descriptors: runtime descriptors, resolvers, and
 * the full type-level map of every supported effect (external + instruction).
 */
export type {
  Effect,
  EffectResult,
  EffectResolver,
  EffectType,
  EffectMap,
  ExternalEffectType,
  ExternalEffectMap,
  InstructionEffectType,
  InstructionEffectMap,
} from "@/effects/types";
