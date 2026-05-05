import type { z } from "zod";
import type { HandlerContext } from "@/context/types";

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
> extends Node {
  kind: "route";
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  inputSchema?: I;
}

/**
 * Configuration for defining a Step.
 */
export type StepConfig<
  I extends z.ZodTypeAny = z.ZodTypeAny,
  O extends z.ZodTypeAny = z.ZodTypeAny,
> = Omit<Step<I, O>, "kind"> & {
  handler: (input: z.infer<I>, context: HandlerContext) => Promise<z.infer<O>>;
};

/**
 * Configuration for defining a Tool.
 */
export type ToolConfig<
  I extends z.ZodTypeAny = z.ZodTypeAny,
  R = unknown,
> = Omit<Tool<I, R>, "kind"> & {
  handler: (input: z.infer<I>, context: HandlerContext) => Promise<R>;
};

/**
 * Configuration for defining a Route.
 */
export type RouteConfig<
  I extends z.ZodTypeAny | undefined = undefined,
  R = unknown,
> = Omit<Route<I, R>, "kind"> & {
  handler: (
    req: Request,
    res: {
      status: (code: number) => { json: (data: R) => void };
      json: (data: R) => void;
    },
    context: HandlerContext,
  ) => Promise<R> | void | Promise<void>;
};

/** Nodes that can be passed to `actions.run()`. */
export type ExecutableNode = AnyStep | AnyTool;

/**
 * All registered nodes including routes (manifest / introspection).
 * Routes are registry-only - they must NEVER be passed to `actions.run()`.
 */
export type RegistryNode = ExecutableNode | Route;
