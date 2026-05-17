import type { z } from "zod";
import type { TypedKalpContext } from "@/context/types";
import { registerNode } from "@/registry";
import { captureFilePath } from "@/utils";

export interface Listener<
  TInput extends z.ZodTypeAny = z.ZodTypeAny,
  TOutput extends z.ZodTypeAny = z.ZodTypeAny,
  TState extends Record<string, unknown> = Record<string, unknown>,
> {
  readonly kind: "listener";
  readonly event: string;
  readonly inputSchema: TInput;
  readonly outputSchema: TOutput;
  readonly handler: (
    payload: z.infer<TInput>,
    context: TypedKalpContext<TState>,
  ) => Promise<z.infer<TOutput>> | z.infer<TOutput>;
  readonly __filePath?: string;
  readonly __internalId?: symbol;
  readonly __runtimeId?: string;
}

export function defineListener<
  TState extends Record<string, unknown> = Record<string, unknown>,
  const TInput extends z.ZodTypeAny = z.ZodTypeAny,
  const TOutput extends z.ZodTypeAny = z.ZodTypeAny,
>(config: {
  event: string;
  inputSchema: TInput;
  outputSchema: TOutput;
  handler: (
    payload: z.infer<TInput>,
    context: TypedKalpContext<TState>,
  ) => Promise<z.infer<TOutput>> | z.infer<TOutput>;
}): Listener<TInput, TOutput, TState> {
  const listener: Listener<TInput, TOutput, TState> = {
    kind: "listener",
    event: config.event,
    inputSchema: config.inputSchema,
    outputSchema: config.outputSchema,
    handler: config.handler,
    __filePath: captureFilePath(),
    __internalId: Symbol(`listener:${config.event}`),
    __runtimeId: `listener:${config.event}`,
  };

  registerNode("listener", config.event, listener);
  return listener;
}
