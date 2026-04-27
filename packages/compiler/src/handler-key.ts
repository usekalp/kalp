import type { HandlerType } from "@kalphq/sdk";

/**
 * Builds a module reference key for a handler.
 *
 * Maps handler type to a namespaced string (e.g. "step" → "steps.processQuery").
 * Used by the compiler to build {@link HandlerIRNode.moduleRef} values.
 *
 * @param type - The handler type ("lifecycle", "step", "tool", "route").
 * @param id - The handler's unique identifier.
 * @returns A dot-separated module reference string.
 */
export function toHandlerKey(type: HandlerType, id: string): string {
  return `${type}s.${id}`;
}
