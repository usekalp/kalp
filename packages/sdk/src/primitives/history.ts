/**
 * History primitive — read-only conversation history.
 *
 * History is append-only and runtime-owned.
 * Agents cannot mutate history directly.
 *
 * Behavioral invariants:
 * - Append-only
 * - Runtime-owned
 * - Immutable from agents
 *
 * @module
 */

export interface KalpHistoryMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

export interface HistoryListOptions {
  limit?: number;
  before?: string;
  after?: string;
  role?: "user" | "assistant" | "system";
  threadId?: string;
}

export interface KalpHistory {
  list(options?: HistoryListOptions): Promise<KalpHistoryMessage[]>;
}
