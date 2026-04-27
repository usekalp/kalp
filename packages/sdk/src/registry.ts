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

import type { Node } from "@/types";

/**
 * Entry in the node registry.
 *
 * @property kind - Whether this is a `"step"` or `"tool"`.
 * @property id - The node's unique identifier (from its config).
 * @property ref - The runtime reference to the node object.
 */
export interface RegistryEntry {
  kind: "step" | "tool";
  id: string;
  ref: unknown;
}

/**
 * Internal mutable registry map.
 * Key format: `"steps.<id>"` or `"tools.<id>"`.
 */
let registry = new Map<string, RegistryEntry>();

/**
 * Registers a step or tool node in the global registry.
 *
 * Called internally by `defineStep()` and `defineTool()` — zero extra DX cost.
 * Developers never call this directly.
 *
 * @param kind - The node kind (`"step"` or `"tool"`).
 * @param id - The node's unique identifier.
 * @param ref - The runtime node object reference.
 */
export function registerNode(
  kind: "step" | "tool",
  id: string,
  ref: unknown,
): void {
  registry.set(`${kind}s.${id}`, { kind, id, ref });
}

/**
 * Returns the current registry as a read-only Map.
 *
 * Used by the CLI/compiler after loading the agent module to discover
 * all steps and tools that need bundling.
 *
 * @returns The current registry entries.
 */
export function getRegistry(): ReadonlyMap<string, RegistryEntry> {
  return registry;
}

/**
 * Clears the registry.
 *
 * **Must be called** before loading each agent module to prevent
 * cross-contamination between agents, test runs, or hot reloads.
 */
export function clearRegistry(): void {
  registry = new Map();
}
