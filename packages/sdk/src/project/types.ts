import type { IdentityConfig } from "@/identity";
import type { AIProvider, ProviderModelMap } from "@/primitives/ai";

/**
 * MCP (Model Context Protocol) server configuration.
 *
 * @module
 */
/**
 * MCP (Model Context Protocol) server configuration.
 */

/**
 * Marker for environment variables in config.
 * Format: {{env:NAME}}
 */
export const ENV_MARKER_PREFIX = "{{env:";
export const ENV_MARKER_SUFFIX = "}}";

/**
 * Helper to reference environment variables in kalp.config.ts.
 * Returns a marker string that the CLI can identify to track secret requirements.
 */
export const env = (name: string) => `${ENV_MARKER_PREFIX}${name}${ENV_MARKER_SUFFIX}` as unknown as string;

export type McpAuthInput =
  | string // shorthand for { type: "bearer", token: env(string) }
  | {
      type: "bearer";
      token: string;
    }
  | {
      type: "headers";
      headers: Record<string, string>;
    };

export type McpServerInput =
  | string // shorthand for { url: string, transport: "sse" }
  | {
      url: string;
      transport?: "sse" | "stdio";
      auth?: McpAuthInput;
    };

/**
 * Strict internal shape for a normalized MCP server.
 */
export interface NormalizedMcpServer {
  url: string;
  transport: "sse" | "stdio";
  auth?: {
    type: "bearer";
    token?: string;
    tokenEnv?: string;
  } | {
    type: "headers";
    headers: Record<string, string>;
    headersEnv: Record<string, string>; // Maps header name to env var name if applicable
  };
}

/**
 * Project-level configuration types for Kalp.
 *
 * @module
 */

/**
 * Top-level Kalp project configuration, defined in `kalp.config.ts`.
 *
 * This configuration is global to all agents in the project and defines
 * shared resources like secrets and identity configuration.
 *
 * @typeParam TSecrets - Array of secret environment variable names
 * @typeParam TIdentity - Single identity configuration for the project
 */
export interface KalpProjectConfig<
  TSecrets extends readonly string[] = readonly string[],
  TIdentity extends IdentityConfig = IdentityConfig,
  TProvider extends AIProvider = AIProvider,
> {
  /**
   * Environment variable names that should be treated as secrets.
   * These are validated at build time and securely injected at runtime.
   *
   * @example
   * ```typescript
   * secrets: ["OPENAI_API_KEY", "STRIPE_SECRET_KEY"]
   * ```
   */
  secrets: TSecrets;

  /**
   * Identity configuration for authentication.
   * Only ONE identity configuration is supported per project to ensure
   * consistent identity semantics across all agents.
   *
   * For multi-tenant scenarios (users + bots), use a single provider with
   * a custom mapIdentity that handles both cases based on token structure.
   *
   * If undefined, all requests are treated as unauthenticated (public).
   *
   * @example
   * ```typescript
   * identity: {
   *   id: "main",
   *   strategy: {
   *     type: "jwks",
   *     jwksUrl: "https://clerk.example.com/.well-known/jwks.json"
   *   },
   *   mapIdentity: (payload, headers) => {
   *     // Handle both JWT users and API key bots in one config
   *     if (headers?.["x-bot-key"]) {
   *       return { userId: "bot-001" as UserId, claims: { role: "service" } };
   *     }
   *     return {
   *       userId: payload.sub as UserId,
   *       email: payload.email as string,
   *       claims: { role: payload.role || "user" }
   *     };
   *   }
   * }
   * ```
   */
  identity?: TIdentity;

  /**
   * Enforce authentication globally across all agents.
   *
   * - `true` (default): All requests must be authenticated. Unauthenticated
   *   requests are rejected with a 401 before reaching the agent.
   * - `false`: Unauthenticated requests are allowed. The agent must check
   *   `context.auth.isAuthenticated` and handle accordingly.
   *
   * @default true
   */
  enforceGlobalAuth?: boolean;

  /**
   * MCP (Model Context Protocol) server configurations.
   * Servers defined here are available at runtime through `ctx.mcp.<server>.*`.
   * Use `kalp mcp generate` to generate strongly typed tool signatures.
   *
   * @example
   * ```typescript
   * mcp: {
   *   github: {
   *     url: "https://mcp.github.com/sse",
   *     auth: env("GITHUB_TOKEN")
   *   },
   *   wikipedia: "https://mcp.deepwiki.com/mcp"
   * }
   * ```
   */
  mcp?: Record<string, McpServerInput>;

  /**
   * AI provider configuration used by primitives for model typing and defaults.
   */
  ai?: {
    provider: TProvider;
    defaultModel?: ProviderModelMap[TProvider];
    customModels?: readonly string[];
  };
}
