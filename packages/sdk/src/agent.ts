import type { ZodTypeAny } from "zod";
import type {
  AgentContext,
  AgentId,
  BaseContext,
  ExtractStepMetadata,
  ExtractToolMetadata,
  IconConfig,
  Signal,
  Step,
  Tool,
  UserId,
  Webhook,
} from "@/types";

/**
 * Defines an autonomous agent for the Kalp runtime.
 *
 * `defineAgent` is a pure configuration function — it captures the agent's
 * structure and returns it unchanged. The Kalp engine reads this config at
 * deploy-time to wire routing, lifecycle hooks, and LLM integrations.
 *
 * @category Primary API
 * @see Step
 * @see Tool
 * * @typeParam TSteps     - Tuple of registered {@link Step} types.
 * @typeParam TTools     - Tuple of registered {@link Tool} types.
 * @typeParam TWebhooks  - Tuple of registered {@link Webhook} types.
 * @typeParam TSignals   - Tuple of registered {@link Signal} types.
 * @typeParam TUserSchema - The agent's user-defined Drizzle table schema.
 *
 * @example
 * ```ts
 * export default defineAgent({
 * id: asAgentId("support-agent"),
 * name: "Support Agent",
 * steps: [verifyUser],
 * tools: [searchKnowledgeBase],
 * onMessage: async (msg, ctx) => {
 * const user = await ctx.runStep(verifyUser, { email: msg.senderId });
 * return { text: `Hello, ${user.name}` };
 * },
 * });
 * ```
 */
export function defineAgent<
  TSteps extends Step<any, any>[] = [],
  TTools extends Tool<any, any>[] = [],
  TWebhooks extends Webhook<any, any>[] = [],
  TSignals extends Signal<any, any>[] = [],
  TUserSchema extends object = object,
>(config: {
  /** Unique identifier for this agent. Use {@link asAgentId} to cast a string. */
  id: AgentId;
  /** Human-readable display name shown in the Kalp Dashboard. */
  name?: string;
  /** Short description shown in the Dashboard and used in auto-generated docs. */
  description?: string;
  /** Dashboard icon. Must be a valid Lucide icon name. */
  icon?: IconConfig;
  /**
   * Schema version for migration safety. Increment this when the user schema changes
   * to signal the engine that a migration should be applied on the next cold start.
   */
  version?: number;
  /**
   * Base instructions for the LLM.
   *
   * - **Static string**: used verbatim on every call.
   * - **Dynamic function**: called by the engine before each LLM invocation,
   *   receiving the current {@link BaseContext} and pre-extracted tool/step metadata
   *   so the agent can build a self-aware, context-sensitive system prompt.
   */
  systemPrompt?:
    | string
    | ((
        ctx: BaseContext<TUserSchema>,
        meta: {
          /** Serializable metadata for all registered tools — ready for JSON Schema generation. */
          tools: ExtractToolMetadata<TTools>;
          /** Serializable metadata for all registered steps. */
          steps: ExtractStepMetadata<TSteps>;
        },
      ) => Promise<string>);
  /** Registered steps available for `ctx.runStep`. */
  steps?: TSteps;
  /** Registered tools surfaced to the LLM and available for `ctx.callTool`. */
  tools?: TTools;
  /** Inbound webhook handlers registered on this agent's route. */
  webhooks?: TWebhooks;
  /** Typed inter-agent signal handlers. */
  signals?: TSignals;
  /**
   * Lifecycle hook called once when the Durable Object is first created or wakes
   * from hibernation. Use this to run schema migrations or set default state.
   */
  onInit?: (ctx: BaseContext<TUserSchema>) => Promise<void>;
  /**
   * Scheduled hook executed on a recurring interval via the DO Alarms API.
   * Use this for background tasks like follow-ups, clean-up jobs, or polling.
   */
  onTick?: (ctx: BaseContext<TUserSchema>) => Promise<void>;
  /**
   * Primary message handler. Called for every inbound user message.
   * Return a text response, stream tokens via `ctx.ui.stream`, or return void
   * to handle the response entirely through side effects.
   */
  onMessage: (
    message: {
      /** The raw text content of the message. */
      text: string;
      /** Optional structured payload attached to the message. */
      data?: unknown;
      /** Branded identifier of the user who sent the message. */
      senderId: UserId;
    },
    context: AgentContext<TSteps, TTools, TUserSchema>,
  ) => Promise<{ text: string; data?: unknown } | ReadableStream | void>;
}) {
  return config;
}
