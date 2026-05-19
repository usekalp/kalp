/**
 * Reference to an event listener, identified either by its runtime ID or event name.
 */
export interface ListenerRef {
  __runtimeId?: string;
  event?: string;
}

/**
 * A single operation within a storage batch transaction.
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

/**
 * Flexible JSON Schema representation for describing the shape of arbitrary data.
 * Supports nested properties, required fields, enums, and additional schema attributes.
 */
export interface JsonSchema {
  type?: string;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  required?: string[];
  default?: unknown;
  enum?: unknown[];
  [key: string]: unknown;
}
