import type { IdentityConfig } from "@/identity";

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
  TSecrets extends string[] = string[],
  TIdentity extends IdentityConfig = IdentityConfig,
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
}
