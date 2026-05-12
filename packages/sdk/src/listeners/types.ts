import type { z } from "zod";
import type { AgentContract } from "@/contracts/types";
import type { HandlerContext } from "@/context/types";
import { captureFilePath } from "@/utils";

type SourceEmits<TContract extends AgentContract<any, any, any>> =
  TContract extends AgentContract<any, any, infer TEmits> ? TEmits : never;

type InferListenerPayload<
  TContract extends AgentContract<any, any, any>,
  TEvent extends keyof NonNullable<SourceEmits<TContract>>,
> = NonNullable<SourceEmits<TContract>>[TEvent] extends z.ZodTypeAny
  ? z.infer<NonNullable<SourceEmits<TContract>>[TEvent]>
  : unknown;

export interface Listener<
  TContract extends AgentContract<any, any, any> = AgentContract<any, any, any>,
  TEvent extends keyof NonNullable<SourceEmits<TContract>> = keyof NonNullable<
    SourceEmits<TContract>
  >,
> {
  source: TContract;
  event: TEvent;
  handler: (
    payload: InferListenerPayload<TContract, TEvent>,
    context: HandlerContext,
  ) => Promise<void> | void;
  __filePath?: string;
  __internalId?: symbol;
}

export function defineListener<
  const TContract extends AgentContract<any, any, any>,
  const TEvent extends keyof NonNullable<SourceEmits<TContract>>,
>(config: Listener<TContract, TEvent>): Listener<TContract, TEvent> {
  return {
    ...config,
    __filePath: captureFilePath(),
    __internalId: Symbol(`listener:${String(config.event)}`),
  };
}

