import type { z } from "zod";
import type { AgentContract } from "@/contracts/types";
import type { Listener } from "@/listeners/types";
import type { ExecutableNode } from "@/nodes/types";
import type { InputOf, OutputOf } from "@/utils/types";
import { AgentId, UserId } from "@/identity";

/**
 * Action primitive types for orchestrating agent behavior.
 *
 * @module
 */

export type WakeReason =
  | { type: "timeout" }
  | { type: "interrupt"; from: UserId | AgentId }
  | { type: "human_response"; askId: string; response: unknown }
  | { type: "agent_call_completed"; callId: string; result: unknown }
  | { type: "scheduled_time_reached"; scheduledAt: string };

export interface AskOptions {
  timeout?: string | number;
  metadata?: Record<string, unknown>;
}

export interface ListenerDispatchOptions {
  idempotencyKey?: string;
}

export interface KalpActions {
  run: <T extends ExecutableNode>(
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
  emit: <TListener extends Listener<any, any, any>>(
    listener: TListener,
    payload: z.infer<TListener["inputSchema"]>,
    options?: ListenerDispatchOptions,
  ) => Promise<z.infer<TListener["outputSchema"]>>;
  dispatch: <TListener extends Listener<any, any, any>>(
    listener: TListener,
    payload: z.infer<TListener["inputSchema"]>,
    options?: ListenerDispatchOptions,
  ) => Promise<void>;
  callAgent: <TContract extends AgentContract<any, any, any>>(
    contract: TContract,
    input: z.infer<TContract["inputSchema"]>,
  ) => Promise<z.infer<TContract["outputSchema"]>>;
  waitUntil: (date: Date | string | number) => Promise<WakeReason>;
  schedule: <T extends ExecutableNode>(
    node: T,
    date: Date | string | number,
    ...args: InputOf<T> extends never ? [] : [input: InputOf<T>]
  ) => Promise<{ scheduleId: string }>;
}

export type TypedActions<
  TState extends Record<string, unknown> = Record<string, unknown>,
> = KalpActions & {
  readonly __stateBrand?: TState;
};
