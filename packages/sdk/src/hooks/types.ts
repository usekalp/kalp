import type { AgentMessage, AgentResponse, TypedKalpContext } from "@/context/types";
import { captureFilePath } from "@/utils";

export type HookType = "init" | "tick" | "message";

interface HookMeta {
  /** @internal runtime metadata is attached non-enumerably */
}

export interface InitHook<TState extends Record<string, unknown> = Record<string, unknown>>
  extends HookMeta {
  type: "init";
  handler: (ctx: TypedKalpContext<TState>) => Promise<void> | void;
}

export interface TickHook<TState extends Record<string, unknown> = Record<string, unknown>>
  extends HookMeta {
  type: "tick";
  handler: (ctx: TypedKalpContext<TState>) => Promise<void> | void;
}

export interface MessageHook<
  TState extends Record<string, unknown> = Record<string, unknown>,
> extends HookMeta {
  type: "message";
  handler: (
    message: AgentMessage,
    ctx: TypedKalpContext<TState>,
  ) => Promise<AgentResponse | ReadableStream> | AgentResponse | ReadableStream;
}

export type Hook<TState extends Record<string, unknown> = Record<string, unknown>> =
  | InitHook<TState>
  | TickHook<TState>
  | MessageHook<TState>;

export function defineHook<
  TState extends Record<string, unknown> = Record<string, unknown>,
  THook extends Hook<TState> = Hook<TState>,
>(config: THook): THook {
  const runtimeLabel =
    config.type === "message"
      ? "hook:message"
      : `hook:${config.type}:${crypto.randomUUID()}`;

  const hook = {
    ...config,
  };
  Object.defineProperties(hook as object, {
    __filePath: { value: captureFilePath(), enumerable: false, configurable: false },
    __internalId: { value: Symbol(`hook:${config.type}`), enumerable: false, configurable: false },
    __runtimeId: { value: runtimeLabel, enumerable: false, configurable: false },
  });
  return hook;
}
