import type { z } from "zod";
import type { TypedKalpContext } from "@/context/types";

/**
 * Node types for Tools and Routes.
 *
 * @module
 */

/** The kind of a node in the agent graph. */
export type NodeKind = "tool" | "route";
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface NodeMeta {
  /** @internal runtime metadata is stored out-of-band */
}

/**
 * A Tool is a reusable executable unit with typed input/output.
 */
export type ToolHandlerReturn<O, OSchema extends z.ZodTypeAny | undefined> =
  OSchema extends z.ZodTypeAny ? z.infer<OSchema> : O;

export interface Tool<
  I extends z.ZodTypeAny = z.ZodTypeAny,
  O = unknown,
  TState extends Record<string, unknown> = Record<string, unknown>,
  OSchema extends z.ZodTypeAny | undefined = undefined,
> extends NodeMeta {
  kind: "tool";
  id: string;
  description?: string;
  inputSchema: I;
  outputSchema?: OSchema;
  handler: (
    input: z.infer<I>,
    context: TypedKalpContext<TState>,
  ) => Promise<ToolHandlerReturn<O, OSchema>> | ToolHandlerReturn<O, OSchema>;
}

/**
 * An HTTP Route exposed by the agent.
 */
export interface Route<
  M extends HttpMethod = HttpMethod,
  I extends z.ZodTypeAny | undefined = undefined,
  R = unknown,
  TState extends Record<string, unknown> = Record<string, unknown>,
  OSchema extends z.ZodTypeAny | undefined = undefined,
> extends NodeMeta {
  kind: "route";
  id: string;
  method: M;
  path: string;
  skipAuth?: boolean;
  inputSchema?: M extends "GET" | "DELETE" ? never : I;
  outputSchema?: OSchema;
  handler: (args: {
    req: Request;
    res: {
      status: (code: number) => { json: (data: R) => void };
      json: (data: R) => void;
    };
    body: M extends "GET" | "DELETE"
      ? undefined
      : I extends z.ZodTypeAny
        ? z.infer<I>
        : undefined;
    ctx: TypedKalpContext<TState>;
  }) => Promise<OSchema extends z.ZodTypeAny ? z.infer<OSchema> : R> | void | Promise<void>;
}

/** Convenience types for any tool. */
export type AnyTool = Tool<z.ZodTypeAny, unknown, Record<string, unknown>>;

/** Nodes that can be passed to `actions.run()`. Allows any state/schema since the runtime provides the agent's actual state. */
export type ExecutableNode = Tool<any, any, any, any>;

/**
 * All registered nodes including routes (manifest / introspection).
 * Routes are registry-only and must never be passed to `actions.run()`.
 */
export type RegistryNode = ExecutableNode | Route;

/**
 * Configuration for defining a Tool.
 */
export type ToolConfig<
  I extends z.ZodTypeAny = z.ZodTypeAny,
  O = unknown,
  TState extends Record<string, unknown> = Record<string, unknown>,
  OSchema extends z.ZodTypeAny | undefined = undefined,
> = Omit<Tool<I, O, TState, OSchema>, "kind">;

/**
 * Configuration for defining a Route.
 */
export type RouteConfig<
  TState extends Record<string, unknown> = Record<string, unknown>,
  M extends HttpMethod = HttpMethod,
  I extends z.ZodTypeAny | undefined = undefined,
  R = unknown,
  OSchema extends z.ZodTypeAny | undefined = undefined,
> = Omit<
  Route<M, I, R, TState, OSchema>,
  "kind"
>;
