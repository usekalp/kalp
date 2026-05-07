/**
 * Agent introspection primitive.
 *
 * Provides read-only metadata about the current agent execution.
 *
 * @module
 */

import type { ExecutionLog } from "@/engine/execution-log";
import type { AgentIntrospection } from "@kalphq/sdk";
import type { ExecutionContext } from "@/engine/types";

/**
 * Creates an agent introspection primitive.
 *
 * @param log - The execution log for event emission.
 * @param execCtx - Optional execution context for event identity.
 * @param agentConfig - Agent configuration metadata.
 * @returns An {@link AgentIntrospection} instance.
 */
export function createAgentMetaPrimitive(
  log: ExecutionLog,
  execCtx?: ExecutionContext,
  agentConfig?: {
    name: string;
    systemPrompt: string;
    metadata?: Record<string, unknown>;
  },
): AgentIntrospection {
  return {
    agentId: execCtx?.executionId ?? "unknown",
    runId: execCtx?.traceId ?? "unknown",
    name: agentConfig?.name ?? "unknown",
    systemPrompt: agentConfig?.systemPrompt ?? "",
    metadata: agentConfig?.metadata,
  };
}
