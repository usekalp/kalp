/**
 * Internal persistence types for the runtime engine.
 *
 * These types describe batch operations and transaction adapters
 * used by the StateStore and replay infrastructure. They are NOT
 * part of the public SDK surface.
 *
 * @module
 */

/**
 * A single operation within a state batch transaction.
 * Supports put, delete, increment, and compare-and-swap (cas) operations.
 */
export type StorageOperation =
  | { op: "put"; key: string; value: unknown }
  | { op: "delete"; key: string }
  | { op: "increment"; key: string; amount: number }
  | { op: "cas"; key: string; expected: unknown; next: unknown };

/**
 * Adapter interface for performing storage operations within a transaction context.
 */
export interface TransactionAdapter {
  put(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  increment(key: string, amount: number): Promise<void>;
}