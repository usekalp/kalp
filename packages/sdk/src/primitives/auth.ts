/**
 * Authentication and authorization primitive interfaces.
 *
 * Note: KalpAuth interface is defined in ../context/types.ts to avoid circular
 * dependencies and to include the providerId field for identity tracking.
 *
 * @module
 */

export interface SecretsRegistry {
  // Augment this in your kalp.d.ts
}

/** Inferred secret keys from the global registry */
export type RegisteredSecrets = SecretsRegistry extends { keys: infer K }
  ? K extends readonly string[]
    ? K
    : readonly string[]
  : readonly string[];

// Helper to detect if TSecrets has specific literal keys (from codegen) or is generic string[]
type IsGenericStringArray<T> = T extends readonly string[]
  ? string extends T[number]
    ? true // Array contains generic `string`, not specific literals
    : false // Array contains specific literal strings
  : false;

/**
 * Extract literal keys if registered via codegen, fallback to string.
 */
export type SecretKey<TSecrets extends readonly string[]> =
  IsGenericStringArray<TSecrets> extends true
    ? string & Record<never, never> // Allow any string, but preserve autocomplete
    : TSecrets[number]; // Use specific literals from codegen

/**
 * Vault for accessing secrets.
 */
export interface KalpVault {
  /**
   * Get a secret by key.
   * @param key - The secret key (type-safe if using code generation).
   * @returns The secret value.
   */
  get: (key: SecretKey<RegisteredSecrets>) => Promise<string>;
}
