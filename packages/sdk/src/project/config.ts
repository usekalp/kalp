import type { IdentityConfig } from "@/identity";
import type { KalpProjectConfig } from "@/project/types";

/**
 * Project configuration factory function.
 *
 * @module
 */

/**
 * Defines the Kalp project configuration with type checking.
 * Place this in your `kalp.config.ts` at the project root.
 *
 * Provides full type inference for secrets and identity configuration,
 * enabling IDE autocomplete and compile-time validation.
 *
 * @typeParam TSecrets - Array of secret environment variable names
 * @typeParam TIdentity - Single identity configuration
 * @param config - The project configuration object
 * @returns The same configuration object, typed
 *
 * @example
 * ```typescript
 * import { defineConfig, UserId } from "@kalphq/sdk";
 *
 * export default defineConfig({
 *   secrets: ["STRIPE_SECRET_KEY", "OPENAI_API_KEY"],
 *   identity: {
 *     id: "main",
 *     strategy: {
 *       type: "jwks",
 *       jwksUrl: "https://clerk.example.com/.well-known/jwks.json"
 *     },
 *     mapIdentity: (payload, headers) => {
 *       // Handle both JWT users and API key bots
 *       if (headers?.["x-bot-key"]) {
 *         return { userId: "bot-001" as UserId, claims: { role: "service" } };
 *       }
 *       return {
 *         userId: payload.sub as UserId,
 *         email: payload.email as string,
 *         claims: { role: payload.role || "user" }
 *       };
 *     }
 *   },
 *   enforceGlobalAuth: true
 * } as const);
 * ```
 */
export function defineConfig<
  TSecrets extends string[],
  const TIdentity extends IdentityConfig,
>(
  config: KalpProjectConfig<TSecrets, TIdentity>,
): KalpProjectConfig<TSecrets, TIdentity> {
  return config;
}
