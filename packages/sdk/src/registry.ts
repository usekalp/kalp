/**
 * Global scoped registry for autodiscovery of tools and listeners.
 *
 * @module
 */

import { captureFilePath } from "@/utils";

export interface RegistryEntry {
  kind: "tool" | "listener";
  id: string;
  ref: unknown;
}

const REGISTRY_SYMBOL = Symbol.for("@kalphq/sdk/registry");

function getRegistryMap(): Map<string, RegistryEntry> {
  if (!(globalThis as any)[REGISTRY_SYMBOL]) {
    (globalThis as any)[REGISTRY_SYMBOL] = new Map<string, RegistryEntry>();
  }
  return (globalThis as any)[REGISTRY_SYMBOL];
}

export function registerNode(
  kind: "tool" | "listener",
  id: string,
  ref: unknown,
): void {
  const map = getRegistryMap();
  const key = `${kind}s.${id}`;

  if (map.has(key)) {
    throw new Error(`Node ID collision: ${id} is already registered as a ${kind}.`);
  }

  const internalId = Symbol(id);
  const filePath = captureFilePath();

  if (ref && typeof ref === "object") {
    const target = ref as Record<string, unknown>;
    if (!Object.prototype.hasOwnProperty.call(target, "__internalId")) {
      Object.defineProperty(target, "__internalId", {
        value: internalId,
        enumerable: false,
        configurable: false,
      });
    }
    if (!Object.prototype.hasOwnProperty.call(target, "__filePath")) {
      Object.defineProperty(target, "__filePath", {
        value: filePath,
        enumerable: false,
        configurable: false,
      });
    }
  }

  map.set(key, { kind, id, ref });
}

export function getRegistry(): ReadonlyMap<string, RegistryEntry> {
  return getRegistryMap();
}

export function clearRegistry(): void {
  getRegistryMap().clear();
}
