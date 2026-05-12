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
import type { KalpActions, TypedActions } from "@/actions/types";
import type { ExecutableNode } from "@/nodes";
import { UserId } from "@/identity";

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

/**
 * Context passed to all handlers (steps, tools, routes).
 * Flat structure: `context.ai`, `context.memory`, `context.actions`, etc.
 */
export interface HandlerContext {
  ai: KalpAI;
  memory: KalpMemory;
  vault: KalpVault;
  storage: StoragePrimitive;
  auth?: KalpAuth;
  actions: KalpActions;
  log: KalpLog;
  /** MCP (Model Context Protocol) server proxy. */
  mcp: KalpMcp;
  /** Agent introspection - runtime metadata and IDs. */
  agent: AgentIntrospection;
  /** Deterministic date primitive for Event Sourcing. */
  date: KalpDate;
  /** Deterministic math primitive for Event Sourcing. */
  math: KalpMath;
}

/** Convenience alias for {@link HandlerContext}. */
export type KalpCtx = HandlerContext;

/**
 * Data payload for an incoming message.
 */
export interface AgentMessage {
  text: string;
  data?: unknown;
  senderId: UserId;
}

/**
 * Extended context for conversation handlers with conversation state.
 */
export interface AgentContext extends HandlerContext {
  history: KalpHistoryMessage[];
  state: Record<string, unknown>;
}

/**
 * Agent context with type-safe actions bound to the agent's registered nodes.
 */
export interface TypedAgentContext<C> extends Omit<AgentContext, "actions"> {
  actions: TypedActions<
    InferNodes<C>,
    C extends { emits?: infer E } ? E : undefined
  >;
}

/** Response from an agent's `onMessage` handler. */
export type AgentResponse = { text: string; data?: unknown };
