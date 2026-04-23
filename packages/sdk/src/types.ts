import { z } from "zod";

export interface SecretsRegistry {
  keys: readonly string[];
}

/** Inferred secret keys from the global registry */
export type RegisteredSecrets = SecretsRegistry["keys"];

// Model Map

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
  /**
   * The user prompt/message. The runtime automatically manages conversation history.
   */
  prompt: string;
  /**
   * System instructions for the AI.
   */
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
  classify: (params: {
    input: string;
    labels: string[];
    model?: KalpModelId;
    confidenceThreshold?: number;
  }) => Promise<string>;
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

// Helper to detect if TSecrets has specific literal keys (from codegen) or is generic string[]
type IsGenericStringArray<T> = T extends readonly string[]
  ? string extends T[number]
    ? true // Array contains generic `string`, not specific literals
    : false // Array contains specific literal strings
  : false;

// Extract literal keys if registered via codegen, fallback to string
export type SecretKey<TSecrets extends readonly string[]> =
  IsGenericStringArray<TSecrets> extends true
    ? string & Record<never, never> // Allow any string, but preserve autocomplete
    : TSecrets[number]; // Use specific literals from codegen

export interface KalpVault {
  get: (key: SecretKey<RegisteredSecrets>) => Promise<string>;
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

// Node System

export type NodeKind = "step" | "tool" | "flow" | "route";

export interface Node {
  kind: NodeKind;
  id: string;
}

export interface Step<
  I extends z.ZodTypeAny = z.ZodTypeAny,
  O extends z.ZodTypeAny = z.ZodTypeAny,
> extends Node {
  kind: "step";
  description?: string;
  inputSchema: I;
  outputSchema: O;
}

export interface Tool<
  I extends z.ZodTypeAny = z.ZodTypeAny,
  R = unknown,
> extends Node {
  kind: "tool";
  description?: string;
  inputSchema: I;
}

export type AnyStep = Step<z.ZodTypeAny, z.ZodTypeAny>;
export type AnyTool = Tool<z.ZodTypeAny, unknown>;
export type AnyFlow = Flow<unknown, unknown>;

/**
 * Orchestration-only node (Phase 1).
 * Flows are step sequences — they have NO input and return void.
 * I/O phantom generics reserved for Phase 2 execution semantics.
 * Enforced at type level: `InputOf<Flow> = never`, `OutputOf<Flow> = void`.
 */
export interface Flow<I = void, O = void> extends Node {
  kind: "flow";
  description?: string;
  steps: readonly Step<any, any>[];
}

export interface Route<
  I extends z.ZodTypeAny | undefined = undefined,
  R = unknown,
> extends Node {
  kind: "route";
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  inputSchema?: I;
}

export type StepConfig<
  I extends z.ZodTypeAny = z.ZodTypeAny,
  O extends z.ZodTypeAny = z.ZodTypeAny,
> = Omit<Step<I, O>, "kind"> & {
  run: (input: z.infer<I>, context: HandlerContext) => Promise<z.infer<O>>;
};

export type ToolConfig<
  I extends z.ZodTypeAny = z.ZodTypeAny,
  R = unknown,
> = Omit<Tool<I, R>, "kind"> & {
  execute: (input: z.infer<I>, context: HandlerContext) => Promise<R>;
};

export type RouteConfig<
  I extends z.ZodTypeAny | undefined = undefined,
  R = unknown,
> = Omit<Route<I, R>, "kind"> & {
  handler: (
    req: Request,
    res: {
      status: (code: number) => { json: (data: R) => void };
      json: (data: R) => void;
    },
    context: HandlerContext,
  ) => Promise<R> | void | Promise<void>;
};

/** Nodes that can be passed to `actions.run()`. */
export type ExecutableNode = AnyStep | AnyTool | AnyFlow;
/**
 * All registered nodes including routes (manifest / introspection).
 * Routes are registry-only — they must NEVER be passed to `actions.run()`.
 */
export type RegistryNode = ExecutableNode | Route;

// IR Nodes

export type IRNodeId = string & { readonly __brand: "IRNodeId" };

export type IRNodeKind =
  | "entry"
  | "run"
  | "wait"
  | "fetch"
  | "loop"
  | "llm.generate"
  | "llm.stream"
  | "llm.classify";

export interface IRNodeBase {
  kind: IRNodeKind;
  id: IRNodeId;
}

export type RunTargetKind = "step" | "tool";

export interface EntryIRNode extends IRNodeBase {
  kind: "entry";
  handler: string;
}

export interface RouteEntryIRNode extends IRNodeBase {
  kind: "entry";
  handler: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
}

export interface RunIRNode extends IRNodeBase {
  kind: "run";
  targetId: string;
  targetKind: RunTargetKind;
  input?: unknown;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

export interface WaitIRNode extends IRNodeBase {
  kind: "wait";
  duration: string | number;
}

export interface FetchIRNode extends IRNodeBase {
  kind: "fetch";
  url: string;
  init?: unknown;
}

export interface GenerateIRNode extends IRNodeBase {
  kind: "llm.generate";
  model?: string;
  input: unknown;
  schema?: unknown;
}

export interface StreamIRNode extends IRNodeBase {
  kind: "llm.stream";
  model?: string;
  input: unknown;
  schema?: unknown;
}

export interface ClassifyIRNode extends IRNodeBase {
  kind: "llm.classify";
  model?: string;
  input: { text: string; labels: string[] };
  branches: Array<{ label: string; next?: IRNodeId | null }>;
  fallback?: IRNodeId;
  confidenceThreshold?: number;
}

export interface LoopIRNode extends IRNodeBase {
  kind: "loop";
  entry: IRNodeId;
  detached: true;
  key?: string;
  schedule: {
    type: "interval" | "cron" | "event-driven";
    value?: string | number;
  };
  lifecycle: {
    onStart?: IRNodeId;
    onIterationStart?: IRNodeId;
    onIterationEnd?: IRNodeId;
    onError?: IRNodeId;
    onStop?: IRNodeId;
  };
  maxIterations?: number;
  until?: IRNodeId;
  persistent: true;
}

export type IRNode =
  | EntryIRNode
  | RouteEntryIRNode
  | RunIRNode
  | WaitIRNode
  | FetchIRNode
  | GenerateIRNode
  | StreamIRNode
  | ClassifyIRNode
  | LoopIRNode;

export type IREdgeType = "sequential" | "branch" | "nested";

export interface IREdge {
  from: IRNodeId;
  to: IRNodeId;
  type: IREdgeType;
  condition?: string;
}

export interface IRGraph {
  agentId: string;
  entries: Record<string, IRNodeId>;
  nodes: Record<IRNodeId, IRNode>;
  edges: IREdge[];
}

// Type Inference Engine (KTE)

export type InputOf<T> =
  T extends Step<infer I, any>
    ? z.infer<I>
    : T extends Tool<infer I, any>
      ? z.infer<I>
      : T extends Flow
        ? never
        : never;

export type OutputOf<T> =
  T extends Step<any, infer O>
    ? z.infer<O>
    : T extends Tool<any, infer R>
      ? R
      : T extends Flow
        ? void
        : never;

/**
 * Extracts the union of all executable nodes registered in an agent config.
 * Each branch evaluates independently (parallel union, NOT sequential conditional).
 */
export type InferNodes<C> =
  | (C extends { steps: readonly (infer S)[] } ? S : never)
  | (C extends { tools: readonly (infer T)[] } ? T : never)
  | (C extends { flows: readonly (infer F)[] } ? F : never);

// Actions

export interface KalpActions {
  run: <T extends ExecutableNode>(
    node: T,
    ...args: InputOf<T> extends never ? [] : [input: InputOf<T>]
  ) => Promise<OutputOf<T>>;
  wait: (duration: string | number) => Promise<WakeReason>;
  loop: (body: () => Promise<void>) => void;
  fetch: (
    input: string | URL | Request,
    init?: RequestInit,
  ) => Promise<Response>;
}

/** Type-safe actions parameterized by an agent's registered nodes. */
export interface TypedActions<TNodes> {
  run: <T extends TNodes>(
    node: T,
    ...args: InputOf<T> extends never ? [] : [input: InputOf<T>]
  ) => Promise<OutputOf<T>>;
  wait: (duration: string | number) => Promise<WakeReason>;
  loop: (body: () => Promise<void>) => void;
  fetch: (
    input: string | URL | Request,
    init?: RequestInit,
  ) => Promise<Response>;
}

// Context

/**
 * Context passed to all handlers (steps, tools, routes).
 * Flat structure: `context.ai`, `context.memory`, `context.actions`, etc.
 */
export interface HandlerContext {
  ai: KalpAI;
  memory: KalpMemory;
  vault: KalpVault;
  storage: {
    get: <T = unknown>(key: string) => Promise<T | null>;
    put: (key: string, value: unknown) => Promise<void>;
    delete: (key: string) => Promise<void>;
  };
  auth: KalpAuth;
  actions: KalpActions;
}

/** Convenience alias for {@link HandlerContext}. */
export type KalpCtx = HandlerContext;

/**
 * Extended context for `onMessage` with conversation state.
 */
export interface AgentContext extends HandlerContext {
  message: { text: string; data?: unknown; senderId: UserId };
  history: KalpHistoryMessage[];
  state: Record<string, unknown>;
}

/** Agent context with type-safe actions bound to the agent's registered nodes. */
export interface TypedAgentContext<C> extends Omit<HandlerContext, "actions"> {
  message: { text: string; data?: unknown; senderId: UserId };
  actions: TypedActions<InferNodes<C>>;
  history: KalpHistoryMessage[];
  state: Record<string, unknown>;
}

/** Response from an agent's `onMessage` handler. */
export type AgentResponse = { text: string; data?: unknown };
