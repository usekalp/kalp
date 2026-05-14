import { z } from "zod";
import type { Route, RouteConfig } from "@/nodes";
import type { AgentContract } from "@/contracts/types";
import { captureFilePath } from "@/utils";

/**
 * Route factory functions for defining HTTP routes.
 *
 * @module
 */

/**
 * Defines an HTTP route exposed by the agent.
 *
 * Routes are NOT registered in the global registry like steps/tools.
 * They must be explicitly declared in the agent's `routes` array.
 *
 * @typeParam I - Optional Zod schema for request body validation.
 * @typeParam R - The route handler's return type.
 * @param config - The route configuration including method, path, and handler.
 * @returns The defined Route.
 *
 * @example
 * ```typescript
 * export const webhookRoute = defineRoute({
 *   id: "webhook",
 *   method: "POST",
 *   path: "/webhook",
 *   inputSchema: z.object({ event: z.string() }),
 *   async handler(req, res, ctx) {
 *     res.json({ received: true });
 *   }
 * });
 *
 * // In agent definition:
 * export default defineAgent({
 *   id: "my-agent",
 *   routes: [webhookRoute]
 * });
 * ```
 */
export function defineRoute<
  I extends z.ZodTypeAny | undefined = undefined,
  R = unknown,
  TContract extends AgentContract<any, any, any> | undefined = undefined,
>(config: RouteConfig<I, R, TContract>): Route<I, R, TContract> {
  return {
    ...config,
    kind: "route",
    __filePath: captureFilePath(),
    __internalId: Symbol(config.id || `${config.method}:${config.path}`),
  };
}
