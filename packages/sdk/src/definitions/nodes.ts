import { z } from "zod";
import type { Step, Tool, StepConfig, ToolConfig } from "@/nodes";
import { registerNode } from "@/registry";

/**
 * Node factory functions for defining Steps and Tools.
 *
 * @module
 */

/**
 * Defines a typed {@link Step} with automatic `"step"` kind discriminant.
 *
 * Automatically registers the step in the global registry for autodiscovery
 * by the CLI/compiler.
 *
 * @typeParam I - Zod schema for the step's input.
 * @typeParam O - Zod schema for the step's output.
 * @param config - The step configuration including id, schemas, and handler function.
 * @returns The defined Step node.
 *
 * @example
 * ```typescript
 * export const processQuery = defineStep({
 *   id: "processQuery",
 *   inputSchema: z.object({ query: z.string() }),
 *   outputSchema: z.object({ result: z.string() }),
 *   async handler(input, ctx) {
 *     return { result: `Processed: ${input.query}` };
 *   }
 * });
 * ```
 */
export function defineStep<
  I extends z.ZodTypeAny = z.ZodTypeAny,
  O extends z.ZodTypeAny = z.ZodTypeAny,
>(config: StepConfig<I, O>): Step<I, O> {
  const node: Step<I, O> = { ...config, kind: "step" };
  registerNode("step", config.id, node);
  return node;
}

/**
 * Defines a typed {@link Tool} with automatic `"tool"` kind discriminant.
 *
 * Automatically registers the tool in the global registry for autodiscovery
 * by the CLI/compiler.
 *
 * @typeParam I - Zod schema for the tool's input.
 * @typeParam R - The tool's return type.
 * @param config - The tool configuration including id, schema, and handler function.
 * @returns The defined Tool node.
 *
 * @example
 * ```typescript
 * export const searchDocs = defineTool({
 *   id: "searchDocs",
 *   inputSchema: z.object({ term: z.string() }),
 *   async handler(input, ctx) {
 *     return [{ title: "Result", content: "..." }];
 *   }
 * });
 * ```
 */
export function defineTool<I extends z.ZodTypeAny = z.ZodTypeAny, R = unknown>(
  config: ToolConfig<I, R>,
): Tool<I, R> {
  const node: Tool<I, R> = { ...config, kind: "tool" };
  registerNode("tool", config.id, node);
  return node;
}
