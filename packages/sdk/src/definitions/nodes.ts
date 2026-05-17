import { z } from "zod";
import type { Tool, ToolConfig } from "@/nodes";
import { registerNode } from "@/registry";

/**
 * Node factory functions for defining Tools.
 *
 * @module
 */

export function defineTool<
  I extends z.ZodTypeAny = z.ZodTypeAny,
  O = unknown,
  TState extends Record<string, unknown> = Record<string, unknown>,
  OSchema extends z.ZodTypeAny | undefined = undefined,
>(config: ToolConfig<I, O, TState, OSchema>): Tool<I, O, TState, OSchema> {
  const node: Tool<I, O, TState, OSchema> = {
    ...config,
    kind: "tool",
    __runtimeId: `tool:${config.id}`,
  };

  registerNode("tool", config.id, node);
  return node;
}
