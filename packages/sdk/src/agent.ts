import type { z } from "zod";
import type { AgentContract } from "@/contracts";
import type { Route } from "@/nodes";
import type { Listener } from "@/listeners";
import type { CronExpression, IanaTimezone } from "@/schedule";
import type {
  HandlerContext,
  InferAgentEmits,
  TypedAgentContext,
  AgentMessage,
  AgentResponse,
} from "@/context";

type ContractInput<TContract extends AgentContract<any, any, any>> =
  TContract extends AgentContract<infer I, any, any> ? z.infer<I> : never;
type ContractOutput<TContract extends AgentContract<any, any, any>> =
  TContract extends AgentContract<any, infer O, any> ? z.infer<O> : never;

/**
 * Base configuration for an agent definition.
 *
 * Steps and tools are autodiscovered from imports via the SDK registry.
 * Routes remain explicit because they require method/path metadata.
 *
 * @typeParam TContract - Optional contract type for RPC-enabled agents.
 *                        When provided, `onCall` is typed from the contract.
 */
interface AgentConfigBase<
  TContract extends AgentContract<any, any, any> | undefined = undefined,
> {
  /**
   * Display name for the agent. Must be unique within the project.
   * The control plane will generate a kebab-case ID from this name.
   * @example "Sales Bot" → id: "sales-bot"
   */
  name: string;
  label?: string;
  description?: string;
  tags?: readonly string[];
  /**
   * Event schemas emitted by this agent.
   * These events are used for:
   * - typed `ctx.actions.emit(...)` autocomplete
   * - typed listener payload inference
   * - Studio/IR event metadata introspection
   */
  emits?: Record<string, z.ZodTypeAny | string>;
  public?: boolean;
  systemPrompt?:
    | string
    | ((context: HandlerContext) => string | Promise<string>);
  routes?: readonly Route[];
  listeners?: readonly Listener[];
  /** Contract declaration — injects types for onCall handler. */
  contract?: TContract;
  /** Scheduled cron jobs for this agent. */
  cron?: readonly {
    expression: CronExpression;
    handler: () => Promise<void>;
    timezone?: IanaTimezone;
  }[];
}

/**
 * Defines an autonomous agent for the Kalp runtime.
 *
 * `defineAgent` is a pure configuration function — it captures the agent's
 * structure and returns it unchanged. The Kalp engine reads this config at
 * deploy-time to wire routing, lifecycle hooks, and LLM integrations.
 *
 * Uses `const` type parameter to preserve literal tuple types, enabling
 * fully type-safe `actions.run()` without visible generics.
 *
 * For RPC-enabled agents, pass a contract to get type-safe `onCall`:
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
 *
 * @category Primary API
 * @see Step
 * @see Tool
 * @see defineContract
 */
export function defineAgent<
  const TContract extends AgentContract<any, any, any> | undefined,
  const TConfig extends AgentConfigBase<TContract>,
>(
  config: TConfig & {
    // Lifecycle
    /** Called once when the agent starts. */
    onInit?: (
      context: HandlerContext<InferAgentEmits<TConfig>>,
    ) => Promise<void>;
    /** Called periodically on a timer. */
    onTick?: (
      context: HandlerContext<InferAgentEmits<TConfig>>,
    ) => Promise<void>;
    /** Called when a message is received (chat interface). */
    onMessage?: (
      message: AgentMessage,
      ctx: TypedAgentContext<TConfig>,
    ) => Promise<AgentResponse | ReadableStream>;
    /**
     * Called when the agent is invoked via RPC.
     * Only available when a contract is declared.
     * Types are automatically inferred from the contract.
     */
    onCall?: TContract extends AgentContract<any, any, any>
      ? (
          input: ContractInput<TContract>,
          context: HandlerContext<InferAgentEmits<TConfig>>,
        ) => Promise<ContractOutput<TContract>>
      : never;
  },
) {
  return config;
}
