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
}
