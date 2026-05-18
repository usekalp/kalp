/**
 * Action primitive types for orchestrating agent behavior.
 *
 * @module
 */

import type { z } from "zod";
import type { AgentContract } from "@/contracts/types";
import type { Listener } from "@/listeners/types";
import type { ExecutableNode } from "@/nodes/types";
import type { InputOf, OutputOf } from "@/utils/types";
import { AgentId, UserId } from "@/identity";
import type { Duration } from "@/primitives/duration";
import type { CallAction, ListenerCallOptions } from "./call";
import type { DispatchAction, DispatchReceipt, ListenerDispatchOptions } from "./dispatch";
import type { AskAction, AskOptions } from "./ask";
import type { SleepAction, SleepOptions } from "./sleep";
import type { WaitUntilAction, TimestampInput, WaitUntilOptions } from "./wait-until";
import type { LoopAction, LoopContext, LoopOptions } from "./loop";
import type { ScheduleAction, ScheduledTask } from "./schedule";

export type WakeReason =
  | { type: "timeout" }
  | { type: "interrupt"; from: UserId | AgentId }
  | { type: "human_response"; askId: string; response: unknown }
  | { type: "agent_call_completed"; callId: string; result: unknown }
  | { type: "scheduled_time_reached"; scheduledAt: string };

export interface KalpActions {
  /** Execute a node (tool/route) and return its output. */
  run: <T extends ExecutableNode>(
    node: T,
    ...args: InputOf<T> extends never ? [] : [input: InputOf<T>]
  ) => Promise<OutputOf<T>>;

  /** Request/response — invoke a listener and await its typed output. */
  call: CallAction;

  /** Fire-and-forget — enqueue a listener invocation. */
  dispatch: DispatchAction;

  /** Human-in-the-loop — prompt a user and await response. */
  ask: AskAction;

  /** Request approval from a human user. */
  requestApproval: (reason: string, options?: { timeout?: Duration; signal?: AbortSignal }) => Promise<boolean>;

  /** Pause execution for the given duration. */
  sleep: SleepAction;

  /** Pause execution until the given absolute timestamp. */
  waitUntil: WaitUntilAction;

  /** Schedule a node for future execution. */
  schedule: ScheduleAction;

  /** Execute a loop with typed return value and stop() control. */
  loop: LoopAction;

  /** Fetch a URL (pass-through to native fetch). */
  fetch: (
    input: string | URL | Request,
    init?: RequestInit,
  ) => Promise<Response>;

  /** Call another agent via its contract. */
  callAgent: <TContract extends AgentContract<any, any, any>>(
    contract: TContract,
    input: z.infer<TContract["inputSchema"]>,
  ) => Promise<z.infer<TContract["outputSchema"]>>;
}

// Re-export action types for external use
export type {
  CallAction,
  DispatchAction,
  DispatchReceipt,
  AskAction,
  AskOptions,
  SleepAction,
  SleepOptions,
  WaitUntilAction,
  WaitUntilOptions,
  LoopAction,
  LoopContext,
  LoopOptions,
  ScheduleAction,
  ScheduledTask,
  ListenerCallOptions,
  ListenerDispatchOptions,
  TimestampInput,
};

declare const STATE_BRAND: unique symbol;

export type TypedActions<
  TState extends Record<string, unknown> = Record<string, unknown>,
> = KalpActions & {
  readonly [STATE_BRAND]?: TState;
};
