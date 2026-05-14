import type { z } from "zod";
import type {
  KalpAI,
  KalpHistoryMessage,
  KalpLog,
  KalpMemory,
  KalpVault,
  StoragePrimitive,
  KalpMcp,
  AgentIntrospection,
  KalpDate,
  KalpMath,
} from "@/primitives";
import type { TypedActions } from "@/actions/types";
import type { ExecutableNode } from "@/nodes";
import type { AgentContract } from "@/contracts/types";
import { UserId } from "@/identity";

import type { Simplify } from "@/utils/types";

/**
 * Context types for handler execution.
 *
 * @module
 */

/**
 * Authentication context for the current request/execution.
 * Populated by the runtime from JWT, API key, or session.
 */
export interface KalpAuth {
  /** Unique user identifier (matches message.senderId in onMessage) */
  userId: UserId;
  /**
   * Identifier of the identity provider that authenticated this user.
   * Matches the `id` field from the provider config in kalp.config.ts.
   * Example: "clerk", "auth0", "internal-bot"
   */
  providerId: string;
  /** User's email if available */
  email?: string;
  /** User's display name */
  name?: string;
  /** Raw JWT or API key token for external API calls */
  token?: string;
  /** Custom claims from the identity provider (roles, permissions, etc.) */
  claims: Record<string, unknown>;
  /** Check if user has a specific permission based on mapped claims */
  hasPermission: (permission: string) => boolean;
}

/**
 * Extracts the union of all executable nodes registered in an agent config.
 * Falls back to ExecutableNode when using autodiscovery (no explicit steps/tools arrays).
 */
export type InferNodes<C> =
  | (C extends { steps: readonly (infer S)[] } ? S : never)
  | (C extends { tools: readonly (infer T)[] } ? T : never)
  | ExecutableNode;

export type InferAgentEmits<C> =
  // Case 1: C is an AgentContract directly
  C extends AgentContract<any, any, infer E>
    ? E extends Record<string, any>
      ? E
      : {}
  // Case 2: C is an agent config with a contract property
  : C extends { contract?: infer Cont }
    ? Cont extends AgentContract<any, any, infer E>
      ? E extends Record<string, any>
        ? E
        : {}
      : {}
    : {};


/**
 * Unified context passed to ALL handlers: steps, tools, routes, listeners,
 * onMessage, onCall, onInit, onTick, cron.
 *
 * Single context type for the entire SDK. Type parameters control
 * whether `actions.emit` is strictly typed or loosely typed.
 *
 * - When `TEmits = {}` (default): `emit` accepts `(string, any)`.
 * - When `TEmits` is populated from a contract: `emit` is strictly typed.
 */
export type KalpContext<
  TEmits extends Record<string, any> = {},
  TActions = TypedActions<ExecutableNode, TEmits>,
> = Simplify<{
  ai: KalpAI;
  memory: KalpMemory;
  vault: KalpVault;
  storage: StoragePrimitive;
  auth?: KalpAuth;
  actions: TActions;
  log: KalpLog;
  /** MCP (Model Context Protocol) server proxy. */
  mcp: KalpMcp;
  /** Agent introspection - runtime metadata and IDs. */
  agent: AgentIntrospection;
  /** Deterministic date primitive for Event Sourcing. */
  date: KalpDate;
  /** Deterministic math primitive for Event Sourcing. */
  math: KalpMath;
  /** Conversation history for the current session. */
  history: KalpHistoryMessage[];
  /** Arbitrary key-value state for the current agent/session. */
  state: Record<string, unknown>;
}>;

/**
 * Fully typed context inferred from an agent config.
 * Automatically resolves emits and nodes from the agent's contract.
 */
export type TypedKalpContext<C> = KalpContext<
  InferAgentEmits<C>,
  TypedActions<InferNodes<C>, InferAgentEmits<C>>
>;

/**
 * Data payload for an incoming message.
 */
export interface AgentMessage {
  text: string;
  data?: unknown;
  senderId: UserId;
}

/** Response from an agent's `onMessage` handler. */
export type AgentResponse = { text: string; data?: unknown };
