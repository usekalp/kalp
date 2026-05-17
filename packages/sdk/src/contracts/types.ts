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
  const contract: AgentContract<TInput, TOutput, TState> = {
    kind: "contract",
    name: config.name,
    inputSchema: config.inputSchema,
    outputSchema: config.outputSchema,
    handler: config.handler,
  };
  Object.defineProperties(contract as object, {
    __filePath: { value: captureFilePath(), enumerable: false, configurable: false },
    __internalId: { value: Symbol(`contract:${config.name}`), enumerable: false, configurable: false },
    __runtimeId: { value: `contract:${config.name}`, enumerable: false, configurable: false },
  });
  return contract;
}

export function defineContractFor<TState extends Record<string, unknown>>() {
  return function <
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
    return defineContract<TState, TInput, TOutput>(config);
  };
}
