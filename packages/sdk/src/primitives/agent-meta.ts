/**
 * Agent introspection primitive interface.
 *
 * Provides read-only metadata about the current agent execution.
 * Runtime IDs (agentId, runId) are injected by the runtime engine.
 *
 * @module
 */

/**
 * Introspection interface for the currently executing agent.
 * All properties are read-only and injected at runtime.
 */
export interface AgentIntrospection {
  /**
   * Stable agent identifier for the running actor.
   * In local runtimes this is typically the agent name/thread binding.
   */
  agentId: string;

  /**
   * Execution run identifier.
   * Unique for each handler execution/resume flow.
   */
  runId: string;

  /**
   * Agent display name from defineAgent configuration.
   * @example "reviewer"
   */
  name: string;

  /**
   * Static system prompt from defineAgent configuration.
   * Use this as the base for dynamic prompt construction.
   *
   * @example
   * ```typescript
   * const dynamicPrompt = ctx.agent.systemPrompt +
   *   "\n\nContext: " + await ctx.storage.get("status");
   * ```
   */
  systemPrompt: string;

  /**
   * Optional custom metadata passed during agent creation.
   */
  metadata?: Record<string, unknown>;
}
