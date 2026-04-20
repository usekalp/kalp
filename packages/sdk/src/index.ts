import { z } from "zod";
import type {
  Flow,
  HandlerContext,
  KalpAuth,
  RegisteredSecrets,
  Route,
  Step,
  Tool,
} from "@/types";

export type { HandlerContext, KalpAuth };
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

/**
 * Creates a typed {@link Step} and attaches the `"step"` kind discriminant.
 *
 * @typeParam I           - Zod schema for the step's input.
 * @typeParam O           - Zod schema for the step's output.
 * @typeParam TUserSchema - The agent's database schema (forwarded to `ctx`).
 * @typeParam TSecrets    - The secret keys from `kalp.config.ts`.
 * @typeParam TSteps      - Registered steps for action context.
 * @typeParam TTools      - Registered tools for action context.
 * @typeParam TFlows      - Registered flows for action context.
 */
export const createStep = <
  I extends z.ZodTypeAny,
  O extends z.ZodTypeAny,
  TUserSchema extends object = object,
  TSecrets extends string[] = RegisteredSecrets,
  TSteps extends Step<any, any, any, any, any, any, any>[] = [],
  TTools extends Tool<any, any, any, any, any, any>[] = [],
  TFlows extends Flow<any>[] = [],
>(
  config: Omit<
    Step<I, O, TUserSchema, TSecrets, TSteps, TTools, TFlows>,
    "kind"
  >,
): Step<I, O, TUserSchema, TSecrets, TSteps, TTools, TFlows> => ({
  ...config,
  kind: "step",
});

/**
 * Creates a typed {@link Tool} and attaches the `"tool"` kind discriminant.
 *
 * @typeParam I           - Zod schema for the tool's input.
 * @typeParam R           - The tool's return type.
 * @typeParam TUserSchema - The agent's database schema (forwarded to `ctx`).
 * @typeParam TSecrets    - The secret keys from `kalp.config.ts`.
 * @typeParam TSteps      - Registered steps for action context.
 * @typeParam TTools      - Registered tools for action context.
 * @typeParam TFlows      - Registered flows for action context.
 */
export const createTool = <
  I extends z.ZodTypeAny,
  R = unknown,
  TUserSchema extends object = object,
  TSecrets extends string[] = RegisteredSecrets,
  TSteps extends Step<any, any, any, any, any, any, any>[] = [],
  TTools extends Tool<any, any, any, any, any, any>[] = [],
  TFlows extends Flow<any>[] = [],
>(
  config: Omit<
    Tool<I, R, TUserSchema, TSecrets, TSteps, TTools, TFlows>,
    "kind"
  >,
): Tool<I, R, TUserSchema, TSecrets, TSteps, TTools, TFlows> => ({
  ...config,
  kind: "tool",
});

export const defineRoute = <
  I extends z.ZodTypeAny | undefined = undefined,
  R = unknown,
  TUserSchema extends object = object,
  TSecrets extends string[] = RegisteredSecrets,
  TSteps extends Step<any, any, any, any, any, any, any>[] = [],
  TTools extends Tool<any, any, any, any, any, any>[] = [],
  TFlows extends Flow<any>[] = [],
>(
  config: Route<I, R, TUserSchema, TSecrets, TSteps, TTools, TFlows>,
): Route<I, R, TUserSchema, TSecrets, TSteps, TTools, TFlows> => config;

export const defineFlow = <
  TSteps extends Step<any, any, any, any, any, any, any>[] = Step<
    any,
    any,
    any,
    any,
    any,
    any,
    any
  >[],
>(
  config: Flow<TSteps>,
): Flow<TSteps> => config;

/** Top-level Kalp project configuration, defined in `kalp.config.ts`. */
export interface KalpConfig<TSecrets extends string[] = string[]> {
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
  config: KalpConfig<TSecrets>,
): KalpConfig<TSecrets> {
  return config;
}
