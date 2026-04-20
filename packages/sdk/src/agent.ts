import type {
  AgentContext,
  AgentId,
  HandlerContext,
  Flow,
  RegisteredSecrets,
  Route,
  Step,
  Tool,
  UserId,
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
 * @typeParam TUserSchema - The agent's user-defined Drizzle table schema.
 */
export function defineAgent<
  TSteps extends Step<any, any, any, any, any, any, any>[] = [],
  TTools extends Tool<any, any, any, any, any, any, any>[] = [],
  TFlows extends Flow<any>[] = [],
  TRoutes extends Route<any, any, any, any, any, any, any>[] = [],
  TUserSchema extends object = object,
  TSecrets extends readonly string[] = RegisteredSecrets,
>(config: {
  /** Unique identifier for this agent. Use {@link asAgentId} to cast a string. */
  id: AgentId;
  name?: string;
  description?: string;
  version?: number;
  systemPrompt?:
    | string
    | ((
        context: HandlerContext<TSecrets, TSteps, TTools, TFlows>,
      ) => Promise<string>);
  steps?: TSteps;
  tools?: TTools;
  flows?: TFlows;
  routes?: TRoutes;
  onInit?: (
    context: HandlerContext<TSecrets, TSteps, TTools, TFlows>,
  ) => Promise<void>;
  onTick?: (
    context: HandlerContext<TSecrets, TSteps, TTools, TFlows>,
  ) => Promise<void>;
  onMessage: (
    params: {
      message: {
        text: string;
        data?: unknown;
        senderId: UserId;
      };
    } & AgentContext<TSteps, TTools, TFlows, TUserSchema, TSecrets>,
  ) => Promise<{ text: string; data?: unknown } | ReadableStream | void>;
}) {
  return config;
}
