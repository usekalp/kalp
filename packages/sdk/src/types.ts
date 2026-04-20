import { z } from "zod";

// ─── Global Secrets Registry (Module Augmentation) ──────────────────────────────

/**
 * Global registry for project secrets.
 *
 * To enable type-safe vault access, create a `kalp.d.ts` file in your project root:
 *
 * ```ts
 * import "@kalphq/sdk";
 *
 * declare module "@kalphq/sdk" {
 *   interface SecretsRegistry {
 *     keys: ["STRIPE_SECRET_KEY", "OPENAI_API_KEY"];
 *   }
 * }
 * ```
 */
export interface SecretsRegistry {
  keys: string[];
}

/** Inferred secret keys from the global registry */
export type RegisteredSecrets = SecretsRegistry["keys"];

// ─── Model Map ───────────────────────────────────────────────────────────────

export type ModelMap = {
  openai:
    | "gpt-5.4"
    | "gpt-5.4-nano"
    | "gpt-5-mini"
    | "gpt-5.1-thinking"
    | "gpt-4o"
    | "gpt-4o-mini"
    | "gpt-4-turbo"
    | "gpt-4"
    | "gpt-3.5-turbo";

  anthropic:
    | "claude-opus-4.7"
    | "claude-opus-4.6"
    | "claude-sonnet-4.6"
    | "claude-sonnet-4.5"
    | "claude-haiku-4.5";

  google:
    | "gemini-3-flash"
    | "gemini-3.1-pro-preview"
    | "gemini-3.1-flash-lite-preview"
    | "gemini-2.5-flash"
    | "gemini-1.5-pro"
    | "gemini-1.5-flash"
    | "gemini-1.0-pro";

  groq:
    | "llama-3-70b-8192"
    | "llama-3-8b-8192"
    | "mixtral-8x7b-32768"
    | "gemma-7b-it"
    | "grok-4.1-fast-non-reasoning";

  mistral:
    | "mistral-large-latest"
    | "mistral-medium-latest"
    | "mistral-small-latest";

  perplexity: "llama-3-sonar-large-32k-online" | "llama-3-sonar-small-32k-chat";

  moonshot: "kimi-k2.5";

  openai_other: "gpt-oss-120b" | "gpt-5.3-codex";

  voyage: "voyage-4-lite";
};

export type ProviderName = keyof ModelMap;
export type LocalModelId = `local/${string}`;

export type KalpModelId =
  | {
      [P in ProviderName]: `${P}/${ModelMap[P]}`;
    }[ProviderName]
  | LocalModelId;

export interface AIParams {
  prompt: string;
  system?: string;
  /**
   * Model in `provider/model` format. Example: `openai/gpt-4o`.
   */
  model: KalpModelId;
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
}

export interface KalpAI {
  generate: <T extends z.ZodTypeAny = never>(
    params: AIParams & { schema?: T },
  ) => Promise<T extends z.ZodTypeAny ? z.infer<T> : string>;
  stream: <T extends z.ZodTypeAny = never>(
    params: AIParams & { schema?: T },
  ) => T extends z.ZodTypeAny
    ? AsyncIterable<Partial<z.infer<T>>>
    : AsyncIterable<string>;
}

export interface KalpHistoryMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

export interface MemoryListParams {
  limit?: number;
  cursor?: string;
  order?: "asc" | "desc";
}

export interface MemoryListResult {
  items: KalpHistoryMessage[];
  nextCursor?: string;
}

export type AgentId = string & { readonly __brand: "AgentId" };
export type UserId = string & { readonly __brand: "UserId" };

export const asAgentId = (s: string): AgentId => s as AgentId;
export const asUserId = (s: string): UserId => s as UserId;

export type WakeReason =
  | { type: "timeout" }
  | { type: "interrupt"; from: UserId | AgentId };

export interface KalpMemory {
  list: (params?: MemoryListParams) => Promise<MemoryListResult>;
  append: (message: Omit<KalpHistoryMessage, "timestamp">) => Promise<void>;
  /**
   * Runtime summary snapshot of long conversation history.
   * Kalp can auto-compact prior messages and expose the condensed context here.
   */
  summarize: () => Promise<string>;
}

export type SecretKey<TSecrets extends string[]> = TSecrets[number];

export interface KalpVault<TSecrets extends string[] = RegisteredSecrets> {
  get: (key: SecretKey<TSecrets>) => Promise<string>;
}

/**
 * Authentication context for the current request/execution.
 * Populated by the runtime from JWT, session, or API key.
 */
export interface KalpAuth {
  /** Unique user identifier (matches message.senderId in onMessage) */
  userId: UserId;
  /** User's email if available */
  email?: string;
  /** User's display name */
  name?: string;
  /** Raw JWT or session token for external API calls */
  token?: string;
  /** Custom claims from auth provider (roles, permissions, etc.) */
  claims: Record<string, unknown>;
  /** Check if user has a specific permission */
  hasPermission: (permission: string) => boolean;
}

export interface KalpContextState<
  TSecrets extends string[] = RegisteredSecrets,
> {
  memory: KalpMemory;
  vault: KalpVault<TSecrets>;
  storage: {
    get: <T = unknown>(key: string) => Promise<T | null>;
    put: (key: string, value: unknown) => Promise<void>;
    delete: (key: string) => Promise<void>;
  };
  /** Authentication context for the current user/request */
  auth: KalpAuth;
}

export interface KalpActions<
  TSteps extends Step<any, any>[] = [],
  TTools extends Tool<any, any>[] = [],
  TFlows extends Flow<any>[] = [],
> {
  ai: KalpAI;
  wait: (duration: string | number) => Promise<WakeReason>;
  fetch: (
    input: string | URL | Request,
    init?: RequestInit,
  ) => Promise<Response>;
  runStep: <S extends TSteps[number]>(
    step: S,
    input: z.infer<S["input"]>,
  ) => Promise<z.infer<S["output"]>>;
  callTool: <T extends TTools[number]>(
    tool: T,
    input: z.infer<T["input"]>,
  ) => Promise<Awaited<ReturnType<T["execute"]>>>;
  runFlow: <F extends TFlows[number]>(flow: F) => Promise<void>;
}

/**
 * Reusable context object passed to all handlers (steps, tools, routes).
 * Contains `ctx` for state access and `actions` for calling other components.
 */
export interface HandlerContext<
  TSecrets extends string[] = RegisteredSecrets,
  TSteps extends Step<any, any, any, any, any, any, any>[] = [],
  TTools extends Tool<any, any, any, any, any, any>[] = [],
  TFlows extends Flow<any>[] = [],
> {
  ctx: KalpContextState<TSecrets>;
  actions: KalpActions<TSteps, TTools, TFlows>;
}

/**
 * Base context with user schema support (for future Drizzle integration).
 * @deprecated Use HandlerContext directly for most cases.
 */
export interface BaseContext<
  TUserSchema extends object = object,
  TSecrets extends string[] = RegisteredSecrets,
  TSteps extends Step<any, any, any, any, any, any, any>[] = [],
  TTools extends Tool<any, any, any, any, any, any>[] = [],
  TFlows extends Flow<any>[] = [],
> extends HandlerContext<TSecrets, TSteps, TTools, TFlows> {}

export interface AgentActions<
  TSteps extends Step<any, any, any, any, any, any, any>[] = [],
  TTools extends Tool<any, any, any, any, any, any>[] = [],
  TFlows extends Flow<any>[] = [],
> extends KalpActions<TSteps, TTools, TFlows> {}

export interface AgentContextState<
  TSecrets extends string[] = RegisteredSecrets,
> extends KalpContextState<TSecrets> {
  history: KalpHistoryMessage[];
  state: Record<string, unknown>;
}

/**
 * Extended context for onMessage handler with conversation state.
 */
export interface AgentContext<
  TSteps extends Step<any, any, any, any, any, any, any>[] = [],
  TTools extends Tool<any, any, any, any, any, any>[] = [],
  TFlows extends Flow<any>[] = [],
  TUserSchema extends object = object,
  TSecrets extends string[] = RegisteredSecrets,
> extends HandlerContext<TSecrets, TSteps, TTools, TFlows> {
  ctx: AgentContextState<TSecrets>;
}

export interface Step<
  I extends z.ZodTypeAny,
  O extends z.ZodTypeAny,
  TUserSchema extends object = object,
  TSecrets extends string[] = RegisteredSecrets,
  TSteps extends Step<any, any, any, any, any, any, any>[] = [],
  TTools extends Tool<any, any, any, any, any, any>[] = [],
  TFlows extends Flow<any>[] = [],
> {
  kind: "step";
  id: string;
  description?: string;
  input: I;
  output: O;
  run: (
    input: z.infer<I>,
    context: HandlerContext<TSecrets, TSteps, TTools, TFlows>,
  ) => Promise<z.infer<O>>;
}

export interface Tool<
  I extends z.ZodTypeAny,
  R = unknown,
  TUserSchema extends object = object,
  TSecrets extends string[] = RegisteredSecrets,
  TSteps extends Step<any, any, any, any, any, any, any>[] = [],
  TTools extends Tool<any, any, any, any, any, any>[] = [],
  TFlows extends Flow<any>[] = [],
> {
  kind: "tool";
  id: string;
  description?: string;
  input: I;
  execute: (
    input: z.infer<I>,
    context: HandlerContext<TSecrets, TSteps, TTools, TFlows>,
  ) => Promise<R>;
}

export interface Route<
  I extends z.ZodTypeAny | undefined = undefined,
  R = unknown,
  TUserSchema extends object = object,
  TSecrets extends string[] = RegisteredSecrets,
  TSteps extends Step<any, any, any, any, any, any, any>[] = [],
  TTools extends Tool<any, any, any, any, any, any>[] = [],
  TFlows extends Flow<any>[] = [],
> {
  id: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  input?: I;
  handler: (
    req: Request,
    res: {
      status: (code: number) => { json: (data: R) => void };
      json: (data: R) => void;
    },
    context: HandlerContext<TSecrets, TSteps, TTools, TFlows>,
  ) => Promise<R> | void | Promise<void>;
}

export interface Flow<
  TSteps extends Step<any, any, any>[] = Step<any, any, any>[],
> {
  id: string;
  description?: string;
  steps: TSteps;
}
