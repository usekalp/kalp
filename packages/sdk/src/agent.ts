import type {
  AgentId,
  AgentResponse,
  Flow,
  HandlerContext,
  Route,
  Step,
  Tool,
  TypedAgentContext,
} from "@/types";

/** Base shape for the data/config portion of `defineAgent`. */
interface AgentConfigBase {
  id: AgentId;
  name?: string;
  description?: string;
  version?: number;
  systemPrompt?: string | ((context: HandlerContext) => Promise<string>);
  steps?: readonly Step<any, any>[];
  tools?: readonly Tool<any, any>[];
  flows?: readonly Flow<any, any>[];
  routes?: readonly Route[];
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
 * @category Primary API
 * @see Step
 * @see Tool
 */
export function defineAgent<const TConfig extends AgentConfigBase>(
  config: TConfig & {
    // ── Lifecycle ─────────────────────────────────────────────────────────────
    /** Called once when the agent starts. */
    onInit?: (context: HandlerContext) => Promise<void>;
    /** Called periodically on a timer. */
    onTick?: (context: HandlerContext) => Promise<void>;
    /** Called when a message is received. */
    onMessage: (
      ctx: TypedAgentContext<TConfig>,
    ) => Promise<AgentResponse | ReadableStream>;
  },
) {
  return config;
}
