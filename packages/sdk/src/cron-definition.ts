import type { TypedKalpContext } from "@/context/types";
import type { CronExpression, IanaTimezone } from "@/schedule";
import { captureFilePath } from "@/utils";

export interface CronDefinition<
  TState extends Record<string, unknown> = Record<string, unknown>,
> {
  expression: CronExpression;
  timezone?: IanaTimezone;
  handler: (ctx: TypedKalpContext<TState>) => Promise<void> | void;
}

export function defineCron<
  TState extends Record<string, unknown> = Record<string, unknown>,
>(config: CronDefinition<TState>): CronDefinition<TState> {
  const cron = {
    ...config,
  };
  Object.defineProperties(cron as object, {
    __filePath: { value: captureFilePath(), enumerable: false, configurable: false },
    __internalId: { value: Symbol("cron"), enumerable: false, configurable: false },
    __runtimeId: { value: `cron:${crypto.randomUUID()}`, enumerable: false, configurable: false },
  });
  return cron;
}
