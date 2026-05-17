import type { TypedKalpContext } from "@/context/types";
import type { CronExpression, IanaTimezone } from "@/schedule";
import { captureFilePath } from "@/utils";

export interface CronDefinition<
  TState extends Record<string, unknown> = Record<string, unknown>,
> {
  expression: CronExpression;
  timezone?: IanaTimezone;
  handler: (ctx: TypedKalpContext<TState>) => Promise<void> | void;
  __filePath?: string;
  __internalId?: symbol;
  __runtimeId?: string;
}

export function defineCron<
  TState extends Record<string, unknown> = Record<string, unknown>,
>(config: Omit<CronDefinition<TState>, "__filePath" | "__internalId" | "__runtimeId">): CronDefinition<TState> {
  return {
    ...config,
    __filePath: captureFilePath(),
    __internalId: Symbol("cron"),
    __runtimeId: `cron:${crypto.randomUUID()}`,
  };
}
