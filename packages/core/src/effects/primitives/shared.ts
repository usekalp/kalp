/**
 * Reference to an event listener, identified either by its runtime ID or event name.
 */
export interface ListenerRef {
  __runtimeId?: string;
  event?: string;
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