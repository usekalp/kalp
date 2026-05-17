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
import { UserId } from "@/identity";

import type { Simplify } from "@/utils/types";

/**
 * Context types for handler execution.
 *
 * @module
 */

export interface KalpAuth {
  userId: UserId;
  providerId: string;
  email?: string;
  name?: string;
  token?: string;
  claims: Record<string, unknown>;
  hasPermission: (permission: string) => boolean;
}

export type InferNodes<_C> = never;

export type InferAgentState<C> = C extends { state: infer TStateSchema }
  ? TStateSchema extends z.ZodTypeAny
    ? z.infer<TStateSchema>
    : TStateSchema extends Record<string, unknown>
      ? TStateSchema
      : Record<string, unknown>
  : Record<string, unknown>;

export type KalpContext<
  TState extends Record<string, unknown> = Record<string, unknown>,
  TActions = TypedActions<TState>,
> = Simplify<{
  ai: KalpAI;
  memory: KalpMemory;
  vault: KalpVault;
  storage: StoragePrimitive;
  auth?: KalpAuth;
  actions: TActions;
  log: KalpLog;
  mcp: KalpMcp;
  agent: AgentIntrospection;
  date: KalpDate;
  math: KalpMath;
  history: KalpHistoryMessage[];
  state: TState;
}>;

export type TypedKalpContext<TState extends Record<string, unknown>> = KalpContext<
  TState,
  TypedActions<TState>
>;

export interface AgentMessage {
  text: string;
  data?: unknown;
  senderId: UserId;
}

export type AgentResponse = { text: string; data?: unknown };
