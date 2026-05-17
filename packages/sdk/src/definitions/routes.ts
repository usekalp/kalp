import { z } from "zod";
import type { Route, RouteConfig } from "@/nodes";
import type { TypedKalpContext } from "@/context/types";
import { captureFilePath } from "@/utils";

/**
 * Defines an HTTP route exposed by the agent.
 */
export function defineRoute<
  TState extends Record<string, unknown>,
  const M extends "GET" | "DELETE",
  R = unknown,
  OSchema extends z.ZodTypeAny | undefined = undefined,
>(
  config: RouteConfig<TState, M, undefined, R, OSchema> & {
    method: M;
    inputSchema?: never;
  },
): Route<M, undefined, R, TState, OSchema>;
export function defineRoute<
  TState extends Record<string, unknown>,
  const M extends "POST" | "PUT" | "PATCH",
  I extends z.ZodTypeAny | undefined = undefined,
  R = unknown,
  OSchema extends z.ZodTypeAny | undefined = undefined,
>(
  config: RouteConfig<TState, M, I, R, OSchema> & {
    method: M;
  },
): Route<M, I, R, TState, OSchema>;
export function defineRoute<
  TState extends Record<string, unknown>,
  const M extends "POST" | "PUT" | "PATCH",
  const I extends z.ZodTypeAny,
  R = unknown,
  OSchema extends z.ZodTypeAny | undefined = undefined,
>(
  config: RouteConfig<TState, M, I, R, OSchema> & { method: M; inputSchema: I },
): Route<M, I, R, TState, OSchema>;
export function defineRoute<
  TState extends Record<string, unknown> = Record<string, unknown>,
  M extends "GET" | "POST" | "PUT" | "PATCH" | "DELETE" = "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  I extends z.ZodTypeAny | undefined = undefined,
  R = unknown,
  OSchema extends z.ZodTypeAny | undefined = undefined,
>(config: RouteConfig<TState, M, I, R, OSchema>): Route<M, I, R, TState, OSchema> {
  const route: Route<M, I, R, TState, OSchema> = {
    ...config,
    kind: "route",
  };
  Object.defineProperties(route as object, {
    __filePath: { value: captureFilePath(), enumerable: false, configurable: false },
    __internalId: { value: Symbol(config.id || `${config.method}:${config.path}`), enumerable: false, configurable: false },
    __runtimeId: { value: `route:${config.method}:${config.path}`, enumerable: false, configurable: false },
  });
  return route;
}

export function defineRouteFor<TState extends Record<string, unknown>>() {
  return function <
    const M extends "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
    const I extends z.ZodTypeAny | undefined = undefined,
    R = unknown,
    OSchema extends z.ZodTypeAny | undefined = undefined,
  >(config: {
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
  }): Route<M, I, R, TState, OSchema> {
    return defineRoute(config as any) as Route<M, I, R, TState, OSchema>;
  };
}
