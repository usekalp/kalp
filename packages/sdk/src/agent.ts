import type { z } from "zod";
import type { AgentContract } from "@/contracts";
import type { Route } from "@/nodes";
import type { Listener } from "@/listeners";
import type { CronExpression, IanaTimezone } from "@/schedule";
import type {
  KalpContext,
  TypedKalpContext,
  AgentMessage,
  AgentResponse,
} from "@/context";

import type { Simplify } from "@/utils/types";


/**
 * Base configuration for an agent definition.
 *
 * Steps and tools are autodiscovered from imports via the SDK registry.
 * Routes remain explicit because they require method/path metadata.
 */
export interface AgentConfigBase<
  TContract extends AgentContract<any, any, any> | undefined =
    undefined,
> {
  /**
   * Display name for the agent. Must be unique within the project.
   */
  name: string;
  label?: string;
  description?: string;
  tags?: readonly string[];
  /**
   * Disables authentication enforcement for this agent's exposed routes.
   *
   * Useful for:
   * - public webhooks
   * - third-party callbacks
   * - unauthenticated APIs
   *
   * Does not affect runtime permissions or internal orchestration access.
   */
  skipAuth?: boolean;
  systemPrompt?:
    | string
    | ((context: KalpContext) => string | Promise<string>);
  routes?: readonly Route<any, any, any>[];
  listeners?: readonly Listener<any, any, any>[];

  /** Contract declaration — injects types for onCall handler. */
  contract?: TContract;
  /** scheduled cron jobs for this agent. */
  cron?: readonly {
    expression: CronExpression;
    handler: (
      context: TypedKalpContext<AgentConfigBase<TContract>>,
    ) => Promise<void>;
    timezone?: IanaTimezone;
  }[];
}

/**
 * Standard handlers available for all agents.
 */
export type AgentHandlers<TConfig extends AgentConfigBase<any>> = {
  /** Called once when the agent starts. */
  onInit?: (context: TypedKalpContext<TConfig>) => Promise<void>;
  /** Called periodically on a timer. */
  onTick?: (context: TypedKalpContext<TConfig>) => Promise<void>;
  /** Called when a message is received (chat interface). */
  onMessage?: (
    message: AgentMessage,
    ctx: TypedKalpContext<TConfig>,
  ) => Promise<AgentResponse | ReadableStream>;
};

/**
 * Contract-specific handlers, only active if a contract is provided.
 */
export type ContractHandlers<TConfig extends AgentConfigBase<any>> = 
  Exclude<TConfig["contract"], undefined> extends AgentContract<infer I, infer O, any>
    ? {
        /**
         * Called when the agent is invoked via RPC.
         * Only available when a contract is declared.
         * Types are automatically inferred from the contract.
         */
        onCall?: (
          input: z.infer<I>,
          context: TypedKalpContext<TConfig>,
        ) => Promise<z.infer<O>>;
      }
    : {};

/**
 * A fully defined agent.
 * This is the return type of `defineAgent`, representing a stable SDK contract.
 */
export type DefinedAgent<
  TContract extends AgentContract<any, any, any> | undefined =
    undefined,
> = Simplify<
  AgentConfigBase<TContract> &
    AgentHandlers<AgentConfigBase<TContract>> &
    ContractHandlers<AgentConfigBase<TContract>>
>;

/**
 * Defines an autonomous agent for the Kalp runtime.
 *
 * `defineAgent` is a pure configuration function that captures the agent's
 * structure and returns it as a stable `DefinedAgent` contract.
 *
 * @example
 * ```typescript
 * export default defineAgent({
 *   name: "Sales Bot",
 *   contract: SalesBotContract,
 *   async onCall(input, ctx) {
 *     return { score: 95 }; // fully typed
 *   }
 * });
 * ```
 */
export function defineAgent<
  TContract extends AgentContract<any, any, any> | undefined = undefined,
>(
  config: AgentConfigBase<TContract> &
    AgentHandlers<AgentConfigBase<TContract>> &
    ContractHandlers<AgentConfigBase<TContract>>,
): DefinedAgent<TContract> {
  return config as any;
}
