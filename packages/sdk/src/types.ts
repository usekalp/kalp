import { z } from "zod";

// ─── Branded IDs ─────────────────────────────────────────────────────────────

/** Compile-time branded string for agent identifiers. Zero runtime overhead. */
export type AgentId = string & { readonly __brand: "AgentId" };
/** Compile-time branded string for user identifiers. Zero runtime overhead. */
export type UserId = string & { readonly __brand: "UserId" };
/** Compile-time branded string for organization identifiers. Zero runtime overhead. */
export type OrgId = string & { readonly __brand: "OrgId" };

/** Asserts a plain string as {@link AgentId}. Identity function — no runtime cost. */
export const asAgentId = (s: string): AgentId => s as AgentId;
/** Asserts a plain string as {@link UserId}. Identity function — no runtime cost. */
export const asUserId = (s: string): UserId => s as UserId;
/** Asserts a plain string as {@link OrgId}. Identity function — no runtime cost. */
export const asOrgId = (s: string): OrgId => s as OrgId;

// ─── Icons ───────────────────────────────────────────────────────────────────

/**
 * Icon descriptor for the Kalp Dashboard.
 * Use any valid Lucide icon name (https://lucide.dev/icons).
 */
export interface IconConfig {
  provider: "lucide";
  /** A valid Lucide icon name, e.g. `"Bot"`, `"Zap"`, `"Brain"`. */
  name: string;
}

// ─── Retry Policy ────────────────────────────────────────────────────────────

/**
 * Controls how the engine retries a failed {@link Step} or {@link Tool}.
 * Executed by the Kalp runtime — the agent code remains unchanged.
 */
export interface RetryPolicy {
  /** Total number of attempts (including the first). */
  attempts: number;
  /** Delay strategy between retries. */
  backoff: "fixed" | "exponential";
}

// ─── Database Contract ───────────────────────────────────────────────────────

/** Opaque brand token for engine-reserved SQLite tables. Cannot be recreated externally. */
declare const __systemTable: unique symbol;
export type SystemTable = { readonly [__systemTable]: true };

/** The engine's built-in schema. Table names are protected by {@link ValidateUserSchema}. */
export type SystemSchema = {
  readonly _kalp_messages: SystemTable;
  readonly _kalp_state: SystemTable;
  readonly _kalp_metrics: SystemTable;
};

/**
 * Guards a user-defined schema against reserved `_kalp_` prefixed table names.
 * Resolves to `never` if any key violates the constraint, producing a compile error.
 */
export type ValidateUserSchema<T> = keyof T & `_kalp_${string}` extends never
  ? T
  : never;

/**
 * Merges the engine's {@link SystemSchema} with a validated user schema.
 * Produces `never` if the user schema contains reserved key names.
 */
export type MergeSchema<S, U> = S & ValidateUserSchema<U>;

/**
 * A typed stub for the Durable Object's SQLite database.
 * The concrete Drizzle instance is injected by the Kalp engine at runtime.
 */
export interface KalpDatabase<TSchema> {
  /** Direct table references for constructing typed queries. */
  readonly tables: TSchema;
  /** Execute a SQL statement and return affected row count. */
  run: (sql: string, bindings?: unknown[]) => Promise<{ rowsAffected: number }>;
  /** Execute a SQL query and return typed rows. */
  all: <T = unknown>(sql: string, bindings?: unknown[]) => Promise<T[]>;
}

// ─── AI Contract ─────────────────────────────────────────────────────────────

/** Parameters for {@link KalpAI.generateText}. */
export interface GenerateTextParams {
  prompt: string;
  /** System message override — prepended before the user prompt. */
  system?: string;
  /** Semantic model tier. The engine maps this to the configured provider model. */
  model?: "fast" | "smart" | "vision";
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
  toolChoice?: "auto" | "required" | "none";
}

/** Parameters for {@link KalpAI.generateObject}. */
export interface GenerateObjectParams<T extends z.ZodTypeAny> {
  prompt: string;
  /** Zod schema used to parse and validate the structured output. */
  schema: T;
  model?: "smart";
}

/**
 * Provider-agnostic AI interface. Injected by the engine — agent code never
 * imports or instantiates an AI SDK directly.
 */
export interface KalpAI {
  /** Generate a text completion from a prompt. */
  generateText: (params: GenerateTextParams) => Promise<string>;
  /** Generate and parse a structured object validated against a Zod schema. */
  generateObject: <T extends z.ZodTypeAny>(
    params: GenerateObjectParams<T>,
  ) => Promise<z.infer<T>>;
}

// ─── UI Contract ─────────────────────────────────────────────────────────────

/**
 * Real-time UI bridge for sending signals to the Kalp Dashboard and CLI.
 * All methods are fire-and-forward — they do not block agent execution.
 */
export interface KalpUI {
  /** Send a structured alert to the Dashboard. */
  sendAlert: (
    message: string,
    level?: "info" | "warning" | "error",
  ) => Promise<void>;
  /** Emit a named event with optional payload to the Dashboard. */
  sendEvent: (event: string, data?: unknown) => Promise<void>;
  /** Stream a text token to the client for real-time output. */
  stream: (token: string) => Promise<void>;
}

// ─── Auth & Identity ─────────────────────────────────────────────────────────

/** Authenticated user, populated from the verified JWT by the auth middleware. */
export interface KalpUser {
  id: UserId;
  email?: string;
  name?: string;
  /** Application-defined role string (e.g. "admin", "member"). */
  role?: string;
  metadata: Record<string, unknown>;
}

/** Organization context, present in B2B and multi-tenant deployments. */
export interface KalpOrg {
  id: OrgId;
  name?: string;
  metadata: Record<string, unknown>;
}

// ─── History ─────────────────────────────────────────────────────────────────

/** A single entry in the agent's conversation history, injected by the engine. */
export interface KalpHistoryMessage {
  role: "user" | "assistant" | "system";
  content: string;
  /** Unix timestamp in milliseconds. */
  timestamp: number;
}

// ─── Logging & Observability ─────────────────────────────────────────────────

type LogMethod = (message: string, data?: Record<string, unknown>) => void;

/**
 * Structured logger. Output is forwarded to the Kalp Dashboard and `kalp dev` CLI.
 * Prefer this over `console.*` for observable, searchable logs.
 */
export interface KalpLogger {
  info: LogMethod;
  warn: LogMethod;
  error: LogMethod;
  debug: LogMethod;
}

/** Minimal tracing interface for annotating performance-critical spans. */
export interface KalpTelemetry {
  /** Open a named span. Call `end()` when the operation completes. */
  span: (name: string) => { end: () => void };
}

// ─── Suspension (Durable Object Alarms) ──────────────────────────────────────

/**
 * Describes why a suspended agent was resumed.
 * Returned by {@link BaseContext.wait} after the agent wakes up.
 */
export type WakeReason =
  | { type: "timeout" }
  | { type: "interrupt"; from: UserId | AgentId }
  | { type: "signal"; name: string; data: unknown };

// ─── Contexts ────────────────────────────────────────────────────────────────

/**
 * The foundational context available to every {@link Step}, {@link Tool},
 * lifecycle hook, and signal handler. Injected by the Kalp engine at runtime.
 *
 * @typeParam TUserSchema - The agent's user-defined Drizzle table schema.
 *   Defaults to an empty schema (system tables only).
 */
export interface BaseContext<TUserSchema extends object = object> {
  /** Durable Object key-value storage. Values survive worker restarts. */
  storage: {
    get: <T = unknown>(key: string) => Promise<T | null>;
    put: (key: string, value: unknown) => Promise<void>;
  };
  /** Encrypted secret store. Values are never logged or exposed to the Dashboard. */
  vault: {
    get: (key: string) => Promise<string>;
  };
  /** Kalp AI interface — provider and model are configured per project. */
  ai: KalpAI;
  /** SQLite database combining the engine's system schema and the agent's user schema. */
  db: KalpDatabase<MergeSchema<SystemSchema, TUserSchema>>;
  /** Real-time UI bridge to the Dashboard and connected clients. */
  ui: KalpUI;
  /** Authenticated user, populated from the verified JWT. */
  user: KalpUser;
  /** Organization context (populated in multi-tenant deployments). */
  org: KalpOrg;
  /** Structured logger forwarded to the Dashboard and CLI. */
  logger: KalpLogger;
  /** Tracing interface for performance instrumentation. */
  telemetry: KalpTelemetry;
  /**
   * Suspends the agent using the Durable Object Alarms API.
   * State is persisted to SQLite and the worker is deallocated until the alarm fires.
   * Returns a {@link WakeReason} describing how the agent was resumed.
   */
  wait: (duration: string | number) => Promise<WakeReason>;
}

// ─── Signals ─────────────────────────────────────────────────────────────────

/**
 * A typed inter-agent signal. Declares a Zod schema for its payload,
 * enabling engine-level validation and full type inference at the call site.
 */
export interface Signal<I extends z.ZodTypeAny, R = void> {
  id: string;
  input: I;
  handler: (input: z.infer<I>, ctx: BaseContext) => Promise<R>;
}

// ─── DSL Primitives ──────────────────────────────────────────────────────────

/**
 * A discrete, reusable unit of work with typed input and output schemas.
 *
 * @typeParam I - Zod schema for the step's input.
 * @typeParam O - Zod schema for the step's output.
 * @typeParam TUserSchema - The agent's database schema, forwarded to {@link BaseContext}.
 */
export interface Step<
  I extends z.ZodTypeAny,
  O extends z.ZodTypeAny,
  TUserSchema extends object = object,
> {
  kind: "step";
  id: string;
  description?: string;
  icon?: IconConfig;
  retryPolicy?: RetryPolicy;
  input: I;
  output: O;
  run: (
    input: z.infer<I>,
    ctx: BaseContext<TUserSchema>,
  ) => Promise<z.infer<O>>;
}

/**
 * An action the agent can invoke, typically to interact with external services.
 * All registered tools are surfaced to the LLM via {@link ExtractToolMetadata}.
 *
 * @typeParam I - Zod schema for the tool's input.
 * @typeParam R - The return type of the tool's execution.
 * @typeParam TUserSchema - The agent's database schema, forwarded to {@link BaseContext}.
 */
export interface Tool<
  I extends z.ZodTypeAny,
  R = unknown,
  TUserSchema extends object = object,
> {
  kind: "tool";
  id: string;
  description?: string;
  icon?: IconConfig;
  retryPolicy?: RetryPolicy;
  input: I;
  execute: (input: z.infer<I>, ctx: BaseContext<TUserSchema>) => Promise<R>;
}

/**
 * An inbound webhook handler with Zod-validated input.
 * Stateless — runs without a full agent context.
 */
export interface Webhook<I extends z.ZodTypeAny, R = unknown> {
  id: string;
  input: I;
  handler: (input: z.infer<I>) => Promise<R>;
}

// ─── Introspection ───────────────────────────────────────────────────────────

/** Serializable metadata for a {@link Tool}, used to generate LLM tool-call specs. */
export interface ToolMetadata {
  id: string;
  description?: string;
  inputSchema: z.ZodTypeAny;
  icon?: IconConfig;
}

/** Serializable metadata for a {@link Step}. */
export interface StepMetadata {
  id: string;
  description?: string;
  inputSchema: z.ZodTypeAny;
  outputSchema: z.ZodTypeAny;
  icon?: IconConfig;
}

/**
 * Maps a tuple of {@link Tool} types to their corresponding {@link ToolMetadata},
 * preserving the tuple structure for exhaustive type inference.
 * The engine uses this to auto-generate tool descriptions for the LLM system prompt.
 */
export type ExtractToolMetadata<TTools extends Tool<any, any, object>[]> = {
  [K in keyof TTools]: TTools[K] extends Tool<infer I, unknown, object>
    ? { id: string; description?: string; inputSchema: I; icon?: IconConfig }
    : never;
};

/**
 * Maps a tuple of {@link Step} types to their corresponding {@link StepMetadata},
 * preserving the tuple structure for exhaustive type inference.
 */
export type ExtractStepMetadata<TSteps extends Step<any, any, object>[]> = {
  [K in keyof TSteps]: TSteps[K] extends Step<infer I, infer O, object>
    ? {
        id: string;
        description?: string;
        inputSchema: I;
        outputSchema: O;
        icon?: IconConfig;
      }
    : never;
};

// ─── Agent Context ────────────────────────────────────────────────────────────

/**
 * The full execution context available inside {@link defineAgent} handlers.
 * Extends {@link BaseContext} with conversation history, step/tool runners,
 * and inter-agent communication primitives.
 *
 * @typeParam TSteps - Tuple of registered step types for exhaustive `runStep` inference.
 * @typeParam TTools - Tuple of registered tool types for exhaustive `callTool` inference.
 * @typeParam TUserSchema - The agent's database schema.
 */
export interface AgentContext<
  TSteps extends Step<any, any>[],
  TTools extends Tool<any, any>[],
  TUserSchema extends object = object,
> extends BaseContext<TUserSchema> {
  /** Ordered conversation history injected by the engine before each `onMessage` call. */
  history: KalpHistoryMessage[];
  /** Short-term in-memory state scoped to the current Durable Object instance. */
  state: Record<string, unknown>;
  /**
   * Sends a typed signal to another agent's Durable Object.
   * Signal routing and schema validation are handled by the engine.
   */
  sendSignal: (
    agentId: AgentId,
    signalName: string,
    data: unknown,
  ) => Promise<void>;
  /** Runs a registered {@link Step} with full inference on input and output types. */
  runStep: <S extends TSteps[number]>(
    step: S,
    input: z.infer<S["input"]>,
  ) => Promise<z.infer<S["output"]>>;
  /** Invokes a registered {@link Tool} with full inference on input and return type. */
  callTool: <T extends TTools[number]>(
    tool: T,
    input: z.infer<T["input"]>,
  ) => Promise<Awaited<ReturnType<T["execute"]>>>;
}
