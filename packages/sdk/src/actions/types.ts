import type { z } from "zod";
import type { AgentContract } from "@/contracts/types";
import type { ExecutableNode } from "@/nodes/types";
import type { InputOf, OutputOf } from "@/utils/types";
import { AgentId, UserId } from "@/identity";

/**
 * Action primitive types for orchestrating agent behavior.
 *
 * @module
 */

/**
 * The reason a suspended agent was woken up.
 */
export type WakeReason =
  | { type: "timeout" }
  | { type: "interrupt"; from: UserId | AgentId }
  | { type: "human_response"; askId: string; response: unknown }
  | { type: "agent_call_completed"; callId: string; result: unknown }
  | { type: "event"; eventName: string; payload: unknown };

/**
 * Options for the ask primitive (HITL).
 */
export interface AskOptions {
  /** Timeout (ms or human-readable like "2d"). Default: 7 days. */
  timeout?: string | number;
  /** Additional metadata for the human reviewer. */
  metadata?: Record<string, unknown>;
}

/**
 * Options for the emit primitive (real-time events).
 */
export interface EmitOptions {
  /** If true, event is not persisted (default: true). */
  ephemeral?: boolean;
  /** If true, also write to execution log for audit trail. */
  persist?: boolean;
}

/**
 * Actions primitive for orchestrating agent behavior.
 * All methods return Promises — actual resolution is handled by the runtime.
 */
export interface KalpActions {
  /** Execute a step or tool with automatic type inference. */
  run: <T extends ExecutableNode>(
    node: T,
    ...args: InputOf<T> extends never ? [] : [input: InputOf<T>]
  ) => Promise<OutputOf<T>>;

  /** Wait for a duration (agent suspends and resumes later). */
  wait: (duration: string | number) => Promise<WakeReason>;

  /** Execute a loop body repeatedly (each iteration is an event). */
  loop: (body: () => Promise<void>) => void;

  /** Fetch with intercepted logging. */
  fetch: (
    input: string | URL | Request,
    init?: RequestInit,
  ) => Promise<Response>;

  /**
   * Ask a human for structured input via HITL.
   * The agent suspends until the human responds or timeout occurs.
   * @param prompt - The question/prompt for the human.
   * @param schema - Zod schema defining the expected response structure.
   * @param options - Optional timeout and metadata.
   * @returns The validated human response.
   */
  ask: <T extends z.ZodTypeAny>(
    prompt: string,
    schema: T,
    options?: AskOptions,
  ) => Promise<z.infer<T>>;

  /**
   * Request a simple boolean approval from a human.
   * Syntax sugar over ask() with z.boolean() schema.
   * @param reason - The reason for the approval request.
   * @param options - Optional timeout and metadata.
   * @returns True if approved, false if rejected.
   */
  requestApproval: (reason: string, options?: AskOptions) => Promise<boolean>;

  /**
   * Emit a real-time event to connected clients (SSE/WebSocket).
   * Fire-and-forget — does not wait for acknowledgment.
   * @param eventName - The event name for subscribers.
   * @param payload - The event payload.
   * @param options - Ephemeral/persistence options.
   */
  emit: (eventName: string, payload: unknown, options?: EmitOptions) => void;

  /**
   * Call another agent via RPC with full type safety.
   * Cross-thread by default (network call to target agent).
   * @param contract - The AgentContract defining the interface.
   * @param input - The input matching the contract's input schema.
   * @returns The output matching the contract's output schema.
   */
  callAgent: <TContract extends AgentContract<any, any>>(
    contract: TContract,
    input: z.infer<TContract["inputSchema"]>,
  ) => Promise<z.infer<TContract["outputSchema"]>>;
}

/**
 * Type-safe actions parameterized by an agent's registered nodes.
 */
export interface TypedActions<TNodes> {
  run: <T extends TNodes>(
    node: T,
    ...args: InputOf<T> extends never ? [] : [input: InputOf<T>]
  ) => Promise<OutputOf<T>>;
  wait: (duration: string | number) => Promise<WakeReason>;
  loop: (body: () => Promise<void>) => void;
  fetch: (
    input: string | URL | Request,
    init?: RequestInit,
  ) => Promise<Response>;
  ask: <T extends z.ZodTypeAny>(
    prompt: string,
    schema: T,
    options?: AskOptions,
  ) => Promise<z.infer<T>>;
  requestApproval: (reason: string, options?: AskOptions) => Promise<boolean>;
  emit: (eventName: string, payload: unknown, options?: EmitOptions) => void;
  callAgent: <TContract extends AgentContract<any, any>>(
    contract: TContract,
    input: z.infer<TContract["inputSchema"]>,
  ) => Promise<z.infer<TContract["outputSchema"]>>;
}
