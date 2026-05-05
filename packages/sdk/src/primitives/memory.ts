import type { KalpHistoryMessage } from "@/primitives/ai";

/**
 * Memory (conversation history) primitive interfaces.
 *
 * @module
 */

/**
 * Parameters for listing memory items.
 */
export interface MemoryListParams {
  /** Maximum number of items to return */
  limit?: number;
  /** Pagination cursor */
  cursor?: string;
  /** Sort order */
  order?: "asc" | "desc";
}

/**
 * Result of a memory list operation.
 */
export interface MemoryListResult {
  /** The memory items */
  items: KalpHistoryMessage[];
  /** Cursor for fetching the next page */
  nextCursor?: string;
}

/**
 * Memory primitive for conversation history management.
 */
export interface KalpMemory {
  /**
   * List memory items with pagination.
   * @param params - List parameters including limit and cursor.
   * @returns Paginated list of messages.
   */
  list: (params?: MemoryListParams) => Promise<MemoryListResult>;

  /**
   * Append a message to the conversation history.
   * @param message - The message to append (timestamp is added automatically).
   */
  append: (message: Omit<KalpHistoryMessage, "timestamp">) => Promise<void>;

  /**
   * Runtime summary snapshot of long conversation history.
   * Kalp can auto-compact prior messages and expose the condensed context here.
   * @returns A summary string of the conversation.
   */
  summarize: () => Promise<string>;
}
