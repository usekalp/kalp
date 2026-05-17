import { z } from "zod";
import type { Route, RouteConfig } from "@/nodes";
import { captureFilePath } from "@/utils";

/**
 * Defines an HTTP route exposed by the agent.
 */
export function defineRoute<
  TState extends Record<string, unknown> = Record<string, unknown>,
  I extends z.ZodTypeAny | undefined = undefined,
  R = unknown,
>(config: RouteConfig<I, R, TState>): Route<I, R, TState> {
  return {
    ...config,
    kind: "route",
    __filePath: captureFilePath(),
    __internalId: Symbol(config.id || `${config.method}:${config.path}`),
    __runtimeId: `route:${config.method}:${config.path}`,
  };
}
