/**
 * Agent definition metadata.
 *
 * Contains declarative metadata about the agent — not runtime state.
 * Runtime state (runId, threadId, etc.) lives in ctx.runtime and ctx.thread.
 *
 * @module
 */

export interface AgentDefinition {
  /** Agent name. */
  name: string;

  /** Human-readable description of what the agent does. */
  description?: string;

  /** Display label for UI purposes. */
  label?: string;

  /** Tags for categorization and filtering. */
  tags?: string[];

  /** Reference to the system prompt (not the raw content). */
  systemPrompt?: {
    id?: string;
    version?: string;
  };

  /** Custom metadata defined at agent creation time. */
  metadata?: Record<string, unknown>;
}

export interface KalpAgent {
  definition: AgentDefinition;
}
