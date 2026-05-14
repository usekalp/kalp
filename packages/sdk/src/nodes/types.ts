import type { z } from "zod";
import type { KalpContext, TypedKalpContext } from "@/context/types";
import type { AgentContract } from "@/contracts/types";

/**
 * Node types for Steps, Tools, and Routes.
 *
 * @module
 */

/** The kind of a node in the agent graph. */
export type NodeKind = "step" | "tool" | "route";

/**
 * Base interface for all nodes.
 */
export interface Node {
  kind: NodeKind;
  id: string;
  __filePath?: string;
  __internalId?: symbol;
}

/**
 * A Step is a reusable unit of work with typed input and output.
 */
export interface Step<
  I extends z.ZodTypeAny = z.ZodTypeAny,
  O extends z.ZodTypeAny = z.ZodTypeAny,
> extends Node {
  kind: "step";
  description?: string;
  inputSchema: I;
  outputSchema: O;
}

/**
 * A Tool is a side-effect operation with typed input.
 */
export interface Tool<
  I extends z.ZodTypeAny = z.ZodTypeAny,
  R = unknown,
> extends Node {
  kind: "tool";
  description?: string;
  inputSchema: I;
}

/**
 * Convenience types for any step or tool.
 */
export type AnyStep = Step<z.ZodTypeAny, z.ZodTypeAny>;
export type AnyTool = Tool<z.ZodTypeAny, unknown>;

/**
 * An HTTP Route exposed by the agent.
 */
export interface Route<
  I extends z.ZodTypeAny | undefined = undefined,
  R = unknown,
  TContract extends AgentContract<any, any, any> | undefined = undefined,
> extends Node {
  kind: "route";
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  /**
   * Disables authentication enforcement for this specific route.
   */
  skipAuth?: boolean;
  inputSchema?: I;
}

/**
 * Configuration for defining a Step.
 */
export type StepConfig<
  I extends z.ZodTypeAny = z.ZodTypeAny,
  O extends z.ZodTypeAny = z.ZodTypeAny,
  TContract extends AgentContract<any, any, any> | undefined = undefined,
> = Omit<Step<I, O>, "kind"> & {
  handler: (
    input: z.infer<I>,
    context: TContract extends AgentContract<any, any, any>
      ? TypedKalpContext<TContract>
      : KalpContext,
  ) => Promise<z.infer<O>>;
};

/**
 * Configuration for defining a Tool.
 */
export type ToolConfig<
  I extends z.ZodTypeAny = z.ZodTypeAny,
  R = unknown,
  TContract extends AgentContract<any, any, any> | undefined = undefined,
> = Omit<Tool<I, R>, "kind"> & {
  handler: (
    input: z.infer<I>,
    context: TContract extends AgentContract<any, any, any>
      ? TypedKalpContext<TContract>
      : KalpContext,
  ) => Promise<R>;
};

/**
 * Configuration for defining a Route.
 */
export type RouteConfig<
  I extends z.ZodTypeAny | undefined = undefined,
  R = unknown,
  TContract extends AgentContract<any, any, any> | undefined = undefined,
> = Omit<Route<I, R, TContract>, "kind"> & {
  handler: (args: {
    req: Request;
    res: {
      status: (code: number) => { json: (data: R) => void };
      json: (data: R) => void;
    };
    body: I extends z.ZodTypeAny ? z.infer<I> : undefined;
    ctx: TContract extends AgentContract<any, any, any>
      ? TypedKalpContext<TContract>
      : KalpContext;
  }) => Promise<R> | void | Promise<void>;
};

/** Nodes that can be passed to `actions.run()`. */
export type ExecutableNode = AnyStep | AnyTool;

/**
 * All registered nodes including routes (manifest / introspection).
 * Routes are registry-only - they must NEVER be passed to `actions.run()`.
 */
export type RegistryNode = ExecutableNode | Route;
