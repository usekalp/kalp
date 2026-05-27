/**
 * KalpContext — the unified context object available to all agents.
 *
 * Composes all namespaces: actions, schedules, time, thread, runtime, agent, history.
 *
 * @module
 */

import type { z } from "zod";
import type { KalpActions, TypedActions } from "@/actions/types";
import type { KalpSchedules } from "@/schedules/types";
import type { KalpTime } from "@/primitives/time";
import type { KalpRuntime } from "@/runtime/types";
import type { KalpAgent } from "@/agent/types";
import type { KalpAI, KalpLog, KalpMemory, KalpVault, KalpHistory, KalpMath, KalpMcp, KalpCache } from "@/primitives";

export interface AgentMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AgentResponse {
  message: AgentMessage;
  done: boolean;
}

/**
 * Auth context — identity of the user who triggered this execution.
 *
 * Only contains WHO, not WHERE or WHEN.
 * Runtime identifiers (executionId, traceId) live in ctx.runtime.
 */
export interface KalpAuth {
  /** User ID from the authenticated identity. */
  userId: string | null;

  /** Email claim from the identity. */
  email: string | null;

  /** Display name from the identity. */
  name: string | null;

  /** Raw JWT claims (custom fields, roles, etc.). */
  claims: Record<string, unknown> | null;

  /** Whether a valid identity was present. */
  isAuthenticated: boolean;

  /** Raw JWT token string (use sparingly — prefer typed fields). */
  getToken: () => string | null;
}

export interface KalpContext<TState = unknown> {
  actions: KalpActions;
  schedules: KalpSchedules;
  cache: KalpCache;
  time: KalpTime;
  runtime: KalpRuntime;
  agent: KalpAgent;
  history: KalpHistory;
  ai: KalpAI;
  log: KalpLog;
  memory: KalpMemory;
  vault: KalpVault;
  math: KalpMath;
  auth: KalpAuth;
  mcp: KalpMcp;
  state: TState;
}

export type InferAgentState<TNodes extends Record<string, unknown>> = {
  [K in keyof TNodes]: TNodes[K] extends { input: infer I; output: infer O }
    ? { input: I; output: O }
    : never;
};

export type TypedKalpContext<
  TState = Record<string, unknown>,
  TNodes extends Record<string, unknown> = Record<string, unknown>,
> = Omit<KalpContext<TState>, "actions"> & {
  actions: TypedActions<InferAgentState<TNodes>>;
};
