import type { z } from "zod";
import type { AgentContract } from "@/contracts";
import type { Route } from "@/nodes";
import type { CronDefinition } from "@/cron-definition";
import type { Hook, MessageHook } from "@/hooks";
import type { KalpContext } from "@/context";

import type { Simplify } from "@/utils/types";

type HasDuplicateMessageHook<
  THooks extends readonly Hook<any>[],
  SeenMessage extends boolean = false,
> = THooks extends readonly [infer First, ...infer Rest]
  ? First extends MessageHook<any>
    ? SeenMessage extends true
      ? true
      : Rest extends readonly Hook<any>[]
        ? HasDuplicateMessageHook<Rest, true>
        : false
    : Rest extends readonly Hook<any>[]
      ? HasDuplicateMessageHook<Rest, SeenMessage>
      : false
  : false;

type EnsureSingleMessageHook<THooks extends readonly Hook<any>[]> =
  HasDuplicateMessageHook<THooks> extends true ? never : THooks;

export interface AgentConfig<
  TStateSchema extends z.ZodTypeAny = z.ZodTypeAny,
  THooks extends readonly Hook<z.infer<TStateSchema>>[] = readonly Hook<z.infer<TStateSchema>>[],
> {
  name: string;
  label?: string;
  description?: string;
  tags?: readonly string[];
  skipAuth?: boolean;
  systemPrompt?:
    | string
    | ((context: KalpContext<z.infer<TStateSchema>>) => string | Promise<string>);
  state: TStateSchema;
  routes?: readonly Route<any, any, any, z.infer<TStateSchema>, any>[];
  contracts?: readonly AgentContract<any, any, z.infer<TStateSchema>>[];
  cron?: readonly CronDefinition<z.infer<TStateSchema>>[];
  hooks?: EnsureSingleMessageHook<THooks>;
}

export type DefinedAgent<
  TStateSchema extends z.ZodTypeAny = z.ZodTypeAny,
  THooks extends readonly Hook<z.infer<TStateSchema>>[] = readonly Hook<z.infer<TStateSchema>>[],
> = Simplify<AgentConfig<TStateSchema, THooks>>;

export function defineAgent<
  TStateSchema extends z.ZodTypeAny,
  THooks extends readonly Hook<z.infer<TStateSchema>>[] = readonly Hook<z.infer<TStateSchema>>[],
>(config: AgentConfig<TStateSchema, THooks>): DefinedAgent<TStateSchema, THooks> {
  return config as DefinedAgent<TStateSchema, THooks>;
}
