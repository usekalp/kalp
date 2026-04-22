import { z } from "zod";
import type {
  Flow,
  HandlerContext,
  KalpAuth,
  Route,
  RouteConfig,
  Step,
  StepConfig,
  Tool,
  ToolConfig,
} from "@/types";

export type { HandlerContext, KalpAuth };
export type { KalpCtx, AgentResponse } from "@/types";
export type {
  Node,
  NodeKind,
  ExecutableNode,
  RegistryNode,
  Step,
  Tool,
  Flow,
  Route,
  IRGraph,
  IREdge,
  IRNode,
  IRNodeBase,
  IRNodeId,
  IRNodeKind,
  EntryIRNode,
  RunTargetKind,
  RunIRNode,
  WaitIRNode,
  FetchIRNode,
  GenerateIRNode,
  StreamIRNode,
  ClassifyIRNode,
  LoopIRNode,
  InputOf,
  OutputOf,
  StepConfig,
  ToolConfig,
  RouteConfig,
  KalpActions,
} from "@/types";
export { asAgentId, asUserId } from "@/types";
export { defineAgent } from "@/agent";
export {
  KalpError,
  KalpValidationError,
  KalpAuthError,
  KalpNotFoundError,
  isKalpError,
  normalizeKalpError,
} from "@/errors";

// ─── Factory functions ───────────────────────────────────────────────────────

/**
 * Defines a typed {@link Step} with automatic `"step"` kind discriminant.
 *
 * @typeParam I - Zod schema for the step's input.
 * @typeParam O - Zod schema for the step's output.
 */
export const defineStep = <
  I extends z.ZodTypeAny = z.ZodTypeAny,
  O extends z.ZodTypeAny = z.ZodTypeAny,
>(
  config: StepConfig<I, O>,
): Step<I, O> => ({
  ...config,
  kind: "step",
});

/**
 * Defines a typed {@link Tool} with automatic `"tool"` kind discriminant.
 *
 * @typeParam I - Zod schema for the tool's input.
 * @typeParam R - The tool's return type.
 */
export const defineTool = <I extends z.ZodTypeAny = z.ZodTypeAny, R = unknown>(
  config: ToolConfig<I, R>,
): Tool<I, R> => ({
  ...config,
  kind: "tool",
});

/**
 * Defines an HTTP route exposed by the agent.
 *
 * @typeParam I - Optional Zod schema for request body validation.
 * @typeParam R - The route handler's return type.
 */
export const defineRoute = <
  I extends z.ZodTypeAny | undefined = undefined,
  R = unknown,
>(
  config: RouteConfig<I, R>,
): Route<I, R> => ({
  ...config,
  kind: "route",
});

/**
 * Defines a multi-step execution flow.
 */
export const defineFlow = (config: Omit<Flow, "kind">): Flow => ({
  ...config,
  kind: "flow",
});

// ─── Project configuration ───────────────────────────────────────────────────

/** Top-level Kalp project configuration, defined in `kalp.config.ts`. */
export interface KalpProjectConfig<TSecrets extends string[] = string[]> {
  secrets: TSecrets;
}

/**
 * Defines the Kalp project configuration with type checking.
 * Place this in your `kalp.config.ts` at the project root.
 *
 * @example
 * ```ts
 * import { defineConfig } from "@kalphq/sdk";
 *
 * export default defineConfig({
 *   secrets: ["STRIPE_SECRET_KEY", "OPENAI_API_KEY"],
 * } as const);
 * ```
 */
export function defineConfig<TSecrets extends string[]>(
  config: KalpProjectConfig<TSecrets>,
): KalpProjectConfig<TSecrets> {
  return config;
}
