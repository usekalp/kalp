/**
 * Storage primitive interfaces for key-value operations with atomic transactions.
 *
 * @module
 */

/**
 * Options for storage put operations with optimistic locking.
 */
export interface StoragePutOptions {
  /** Expected version for optimistic locking */
  expectedVersion?: number;
  /** Time-to-live (ms or human-readable like "1h") */
  ttl?: string | number;
}

/**
 * Transaction context for atomic operations.
 */
export interface StorageTransaction {
  /**
   * Get a value within the transaction.
   * @param key - The key to retrieve.
   * @returns The stored value or null.
   */
  get: <T = unknown>(key: string) => Promise<T | null>;

  /**
   * Put a value (staged until commit).
   * @param key - The key to set.
   * @param value - The value to store.
   */
  put: (key: string, value: unknown) => void;

  /**
   * Delete a key (staged until commit).
   * @param key - The key to delete.
   */
  delete: (key: string) => void;

  /**
   * Get all keys touched in this transaction.
   * @returns Array of keys.
   */
  keys: () => string[];
}

/**
 * Options for storage transactions.
 */
export interface TransactionOptions {
  /** Maximum retry attempts on conflict (default: 3) */
  maxRetries?: number;
  /** Keys to watch for conflicts (optimistic locking) */
  conflictKeys?: string[];
}

/**
 * Storage primitive for durable key-value operations.
 * Supports optimistic locking and atomic transactions.
 */
export interface StoragePrimitive {
  /**
   * Get a value by key.
   * @param key - The key to retrieve.
   * @returns The stored value or null.
   */
  get: <T = unknown>(key: string) => Promise<T | null>;

  /**
   * Put a value with optional optimistic locking.
   * @param key - The key to set.
   * @param value - The value to store.
   * @param options - Optional expectedVersion for optimistic locking.
   */
  put: (
    key: string,
    value: unknown,
    options?: StoragePutOptions,
  ) => Promise<void>;

  /**
   * Delete a value by key.
   * @param key - The key to delete.
   */
  delete: (key: string) => Promise<void>;

  /**
   * Atomically increment a numeric value.
   * @param key - The key to increment.
   * @param amount - The amount to add (default: 1).
   * @returns The new value after increment.
   */
  increment: (key: string, amount?: number) => Promise<number>;

  /**
   * Execute a transaction with optimistic locking.
   * @param callback - The transaction function.
   * @param options - Transaction options.
   * @returns The result of the transaction.
   */
  transaction: <T>(
    callback: (tx: StorageTransaction) => Promise<T>,
    options?: TransactionOptions,
  ) => Promise<T>;
}
