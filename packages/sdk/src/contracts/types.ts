import type { z } from "zod";
import type { TypedKalpContext } from "@/context/types";
import { captureFilePath } from "@/utils";

/**
 * Contract types for type-safe RPC between agents.
 *
 * @module
 */

export interface AgentContract<
  TInput extends z.ZodTypeAny = z.ZodTypeAny,
  TOutput extends z.ZodTypeAny = z.ZodTypeAny,
  TState extends Record<string, unknown> = Record<string, unknown>,
> {
  readonly kind: "contract";
  readonly name: string;
  readonly inputSchema: TInput;
  readonly outputSchema: TOutput;
  readonly handler: (
    input: z.infer<TInput>,
    context: TypedKalpContext<TState>,
  ) => Promise<z.infer<TOutput>> | z.infer<TOutput>;
  readonly __filePath?: string;
  readonly __internalId?: symbol;
  readonly __runtimeId?: string;
}

export function defineContract<
  TState extends Record<string, unknown> = Record<string, unknown>,
  const TInput extends z.ZodTypeAny = z.ZodTypeAny,
  const TOutput extends z.ZodTypeAny = z.ZodTypeAny,
>(config: {
  name: string;
  inputSchema: TInput;
  outputSchema: TOutput;
  handler: (
    input: z.infer<TInput>,
    context: TypedKalpContext<TState>,
  ) => Promise<z.infer<TOutput>> | z.infer<TOutput>;
}): AgentContract<TInput, TOutput, TState> {
  return {
    kind: "contract",
    name: config.name,
    inputSchema: config.inputSchema,
    outputSchema: config.outputSchema,
    handler: config.handler,
    __filePath: captureFilePath(),
    __internalId: Symbol(`contract:${config.name}`),
    __runtimeId: `contract:${config.name}`,
  };
}
