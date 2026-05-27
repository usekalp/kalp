/**
 * Cache primitive interface for ephemeral key-value operations.
 *
 * Provides a simple, deterministic KV store available during handler execution.
 * Operations are replay-safe and traced through the effect pipeline.
 *
 * @module
 */

/**
 * Cache primitive for key-value operations.
 *
 * All operations are async and go through the effect pipeline,
 * ensuring deterministic replay and full traceability.
 */
export interface KalpCache {
  /**
   * Get a value by key.
   * @param key - The key to retrieve.
   * @returns The stored value, or null if not found.
   */
  get: <T = unknown>(key: string) => Promise<T | null>;

  /**
   * Set a value for a key.
   * @param key - The key to set.
   * @param value - The value to store.
   */
  set: (key: string, value: unknown) => Promise<void>;

  /**
   * Delete a value by key.
   * @param key - The key to delete.
   */
  delete: (key: string) => Promise<void>;
}