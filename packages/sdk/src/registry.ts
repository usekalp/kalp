/**
 * Global scoped registry for autodiscovery of steps and tools.
 *
 * When `defineStep()` or `defineTool()` is called, the node is automatically
 * registered here. The CLI reads this registry after loading the agent module
 * to discover all nodes that must be bundled and compiled into the IR.
 *
 * The registry is resettable via {@link clearRegistry} to prevent ghost entries
 * across hot reloads, parallel tests, or multi-agent processes.
 *
 * **IMPORTANT**: This module has side-effects (registry writes). SDK's
 * `package.json` must NOT mark it as side-effect-free, or bundlers may
 * tree-shake `defineStep`/`defineTool` imports and break autodiscovery.
 *
 * @module
 */

import type { z } from "zod";
import type { Step, Tool, Route, StepConfig, ToolConfig, RouteConfig } from "@/nodes";
import type { AgentContract } from "@/contracts/types";
import type { Listener } from "@/listeners/types";
import { captureFilePath } from "@/utils";

/**
 * Entry in the node registry.
 */
export interface RegistryEntry {
  kind: "step" | "tool";
  id: string;
  ref: unknown;
}

// Use a global symbol to ensure the registry is a singleton across multiple SDK instances.
const REGISTRY_SYMBOL = Symbol.for("@kalphq/sdk/registry");
const CONTRACT_SYMBOL = Symbol.for("@kalphq/sdk/registry/contract");

function getRegistryMap(): Map<string, RegistryEntry> {
  if (!(globalThis as any)[REGISTRY_SYMBOL]) {
    (globalThis as any)[REGISTRY_SYMBOL] = new Map<string, RegistryEntry>();
  }
  return (globalThis as any)[REGISTRY_SYMBOL];
}

/**
 * Registers a step or tool node in the global registry.
 */
export function registerNode(
  kind: "step" | "tool",
  id: string,
  ref: unknown,
): void {
  const map = getRegistryMap();
  const key = `${kind}s.${id}`;

  if (map.has(key)) {
    throw new Error(
      `Node ID collision: ${id} is already registered as a ${kind}.`,
    );
  }

  const internalId = Symbol(id);
  const filePath = captureFilePath();

  if (ref && typeof ref === "object") {
    (ref as any).__internalId = internalId;
    (ref as any).__filePath = filePath;
  }

  getRegistryMap().set(`${kind}s.${id}`, { kind, id, ref });
}

/**
 * Returns the current registry as a read-only Map.
 */
export function getRegistry(): ReadonlyMap<string, RegistryEntry> {
  return getRegistryMap();
}

/**
 * Clears the registry.
 */
export function clearRegistry(): void {
  getRegistryMap().clear();
  (globalThis as any)[CONTRACT_SYMBOL] = undefined;
}

/**
 * Returns the active contract bound to the registry, if any.
 */
export function getActiveContract(): unknown {
  return (globalThis as any)[CONTRACT_SYMBOL];
}

/**
 * Binds a contract to the registry and returns typed factory functions.
 *
 * All steps, tools, and routes created from the returned factories
 * automatically inherit the contract's emit types in their handler context.
 *
 * @example
 * ```typescript
 * import { bindContract } from "@kalphq/sdk";
 * import { RevenueContract } from "../contract/revenue-contract";
 *
 * const { defineStep, defineTool, defineRoute } = bindContract(RevenueContract);
 *
 * export const scoreOpportunity = defineStep({
 *   id: "score_opportunity",
 *   inputSchema: z.object({ ... }),
 *   outputSchema: z.object({ ... }),
 *   async handler(input, ctx) {
 *     // ctx.actions.emit is typed to RevenueContract events
 *     // ctx.history and ctx.state are available
 *   }
 * });
 * ```
 */
export function bindContract<
  TContract extends AgentContract<any, any, any>,
>(contract: TContract) {
  // Store contract reference in the global registry for runtime resolution
  (globalThis as any)[CONTRACT_SYMBOL] = contract;

  // Import the actual define functions lazily to avoid circular deps
  const { defineStep: _defineStep } = require("@/definitions/nodes") as typeof import("@/definitions/nodes");
  const { defineTool: _defineTool } = require("@/definitions/nodes") as typeof import("@/definitions/nodes");
  const { defineRoute: _defineRoute } = require("@/definitions/routes") as typeof import("@/definitions/routes");
  const { defineListener: _defineListener } = require("@/listeners/types") as typeof import("@/listeners/types");

  return {
    defineStep: <
      I extends z.ZodTypeAny = z.ZodTypeAny,
      O extends z.ZodTypeAny = z.ZodTypeAny,
    >(config: StepConfig<I, O, TContract>): Step<I, O> => {
      return _defineStep<I, O, TContract>(config);
    },

    defineTool: <
      I extends z.ZodTypeAny = z.ZodTypeAny,
      R = unknown,
    >(config: ToolConfig<I, R, TContract>): Tool<I, R> => {
      return _defineTool<I, R, TContract>(config);
    },

    defineRoute: <
      I extends z.ZodTypeAny | undefined = undefined,
      R = unknown,
    >(config: RouteConfig<I, R, TContract>): Route<I, R, TContract> => {
      return _defineRoute<I, R, TContract>(config);
    },

    defineListener: <
      TSourceContract extends AgentContract<any, any, any>,
      TEvent extends keyof NonNullable<TSourceContract extends AgentContract<any, any, infer E> ? E : never>,
    >(config: Listener<TSourceContract, TEvent, TContract>): Listener<TSourceContract, TEvent, TContract> => {
      return _defineListener<TSourceContract, TEvent, TContract>(config);
    },
  };
}
