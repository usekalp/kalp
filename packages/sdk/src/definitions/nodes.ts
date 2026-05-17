import { z } from "zod";
import type { Tool, ToolConfig } from "@/nodes";
import { registerNode } from "@/registry";
import type { TypedKalpContext } from "@/context/types";

/**
 * Node factory functions for defining Tools.
 *
 * @module
 */

export function defineTool<
  TState extends Record<string, unknown> = Record<string, unknown>,
  const I extends z.ZodTypeAny = z.ZodTypeAny,
  const OSchema extends z.ZodTypeAny = z.ZodTypeAny,
>(
  config: ToolConfig<I, z.infer<OSchema>, TState, OSchema> & {
    outputSchema: OSchema;
  },
): Tool<I, z.infer<OSchema>, TState, OSchema>;
export function defineTool<
  TState extends Record<string, unknown> = Record<string, unknown>,
  const I extends z.ZodTypeAny = z.ZodTypeAny,
  O = unknown,
>(
  config: ToolConfig<I, O, TState, undefined> & {
    outputSchema?: undefined;
  },
): Tool<I, O, TState, undefined>;
export function defineTool<
  TState extends Record<string, unknown> = Record<string, unknown>,
  I extends z.ZodTypeAny = z.ZodTypeAny,
  O = unknown,
  OSchema extends z.ZodTypeAny | undefined = undefined,
>(config: ToolConfig<I, O, TState, OSchema>): Tool<I, O, TState, OSchema> {
  const node: Tool<I, O, TState, OSchema> = {
    ...config,
    kind: "tool",
  };
  Object.defineProperties(node as object, {
    __runtimeId: { value: `tool:${config.id}`, enumerable: false, configurable: false },
  });

  registerNode("tool", config.id, node);
  return node;
}

/**
 * Curried helper to bind state type first while preserving schema inference.
 * Usage: defineToolFor<AgentState>()({ ... })
 */
export function defineToolFor<TState extends Record<string, unknown>>(): {
  <const I extends z.ZodTypeAny, const OSchema extends z.ZodTypeAny>(
    config: Omit<ToolConfig<I, z.infer<OSchema>, TState, OSchema>, "handler"> & {
      outputSchema: OSchema;
      handler: (
        input: z.infer<I>,
        context: TypedKalpContext<TState>,
      ) => Promise<z.infer<OSchema>> | z.infer<OSchema>;
    },
  ): Tool<I, z.infer<OSchema>, TState, OSchema>;
  <const I extends z.ZodTypeAny, O = unknown>(
    config: Omit<ToolConfig<I, O, TState, undefined>, "handler"> & {
      outputSchema?: undefined;
      handler: (
        input: z.infer<I>,
        context: TypedKalpContext<TState>,
      ) => Promise<O> | O;
    },
  ): Tool<I, O, TState, undefined>;
} {
  return ((config: ToolConfig<any, any, TState, any>) =>
    defineTool(config as ToolConfig<any, any, TState, any>)) as {
    <const I extends z.ZodTypeAny, const OSchema extends z.ZodTypeAny>(
      config: Omit<ToolConfig<I, z.infer<OSchema>, TState, OSchema>, "handler"> & {
        outputSchema: OSchema;
        handler: (
          input: z.infer<I>,
          context: TypedKalpContext<TState>,
        ) => Promise<z.infer<OSchema>> | z.infer<OSchema>;
      },
    ): Tool<I, z.infer<OSchema>, TState, OSchema>;
    <const I extends z.ZodTypeAny, O = unknown>(
      config: Omit<ToolConfig<I, O, TState, undefined>, "handler"> & {
        outputSchema?: undefined;
        handler: (
          input: z.infer<I>,
          context: TypedKalpContext<TState>,
        ) => Promise<O> | O;
      },
    ): Tool<I, O, TState, undefined>;
  };
}
