import type { UserId } from "@/identity/brands";

/**
 * Authentication strategies and identity configuration for Kalp.
 *
 * @module
 */

/**
 * Raw JWT payload before identity mapping.
 * Contains standard JWT claims (sub, iss, aud, exp, iat) plus custom claims.
 */
export type JwtPayload = Record<string, unknown>;

/**
 * JWKS (JSON Web Key Set) strategy for asymmetric JWT validation.
 * Used by SaaS providers like Clerk, Auth0, Supabase.
 */
export interface JwksStrategy {
  type: "jwks";
  /** URL to the JWKS endpoint. Example: https://clerk.example.com/.well-known/jwks.json */
  jwksUrl: string;
  /** Optional expected issuer (iss claim) */
  issuer?: string;
  /** Optional expected audience (aud claim) */
  audience?: string;
}

/**
 * Symmetric key strategy for HS256 JWT validation.
 * The secret is read from an environment variable (never hardcoded).
 */
export interface SymmetricStrategy {
  type: "symmetric";
  /** Name of the environment variable containing the secret. Example: "MY_JWT_SECRET" */
  secretEnvKey: string;
}

/**
 * API key strategy for machine-to-machine (M2M) authentication.
 * Validates a static key passed in a header.
 */
export interface ApiKeyStrategy {
  type: "apiKey";
  /** Name of the header containing the API key. Default: "x-api-key" */
  headerName?: string;
  /** Name of the environment variable containing the valid API key */
  envKey: string;
}

/**
 * Authentication strategy union type.
 * - jwks: Asymmetric validation via JWKS endpoint (recommended for SaaS)
 * - symmetric: HS256 validation with shared secret (simple, single-tenant)
 * - apiKey: Static key for bots/webhooks
 */
export type AuthStrategy = JwksStrategy | SymmetricStrategy | ApiKeyStrategy;

/**
 * Identity configuration for a Kalp project.
 *
 * Defines the authentication strategy and identity mapping for all agents
 * in the project. Only ONE identity provider is supported per project to
 * ensure consistent identity semantics across all agents.
 *
 * For multi-tenant scenarios (e.g., Clerk for users + internal API keys for bots),
 * define a single provider with a custom mapIdentity that handles both cases
 * based on token structure or headers.
 *
 * @example
 * ```typescript
 * {
 *   id: "main",
 *   strategy: { type: "jwks", jwksUrl: "https://clerk.com/.well-known/jwks.json" },
 *   mapIdentity: (payload, headers) => {
 *     // Handle both JWT users and API key bots
 *     if (headers["x-bot-key"]) {
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
export interface IdentityConfig {
  /** Unique identifier for this identity configuration */
  id: string;
  /** Validation strategy. If undefined, all requests are public (no auth) */
  strategy?: AuthStrategy;
  /**
   * Pure function to map validated JWT payload or API key context to KalpAuth fields.
   * Receives both the payload and raw headers for flexible multi-tenant handling.
   * The runtime adds `hasPermission` and `providerId` automatically.
   */
  mapIdentity: (
    payload: JwtPayload,
    headers?: Record<string, string | string[] | undefined>,
  ) => {
    userId: UserId;
    email?: string;
    name?: string;
    claims: Record<string, unknown>;
  };
}
