import type {
  KalpAI,
  KalpHistoryMessage,
  KalpLog,
  KalpMemory,
  KalpVault,
  StoragePrimitive,
} from "@/primitives";
import type { KalpActions, TypedActions } from "@/actions/types";
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
 */
export type InferNodes<C> =
  | (C extends { steps: readonly (infer S)[] } ? S : never)
  | (C extends { tools: readonly (infer T)[] } ? T : never);

/**
 * Context passed to all handlers (steps, tools, routes).
 * Flat structure: `context.ai`, `context.memory`, `context.actions`, etc.
 */
export interface HandlerContext {
  ai: KalpAI;
  memory: KalpMemory;
  vault: KalpVault;
  storage: StoragePrimitive;
  auth: KalpAuth;
  actions: KalpActions;
  log: KalpLog;
}

/** Convenience alias for {@link HandlerContext}. */
export type KalpCtx = HandlerContext;

/**
 * Extended context for `onMessage` with conversation state.
 */
export interface AgentContext extends HandlerContext {
  message: { text: string; data?: unknown; senderId: UserId };
  history: KalpHistoryMessage[];
  state: Record<string, unknown>;
}

/**
 * Agent context with type-safe actions bound to the agent's registered nodes.
 */
export interface TypedAgentContext<C> extends Omit<HandlerContext, "actions"> {
  message: { text: string; data?: unknown; senderId: UserId };
  actions: TypedActions<InferNodes<C>>;
  history: KalpHistoryMessage[];
  state: Record<string, unknown>;
}

/** Response from an agent's `onMessage` handler. */
export type AgentResponse = { text: string; data?: unknown };
