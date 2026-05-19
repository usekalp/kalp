import type {
  IRGraph,
  KalpContext,
  KalpHistory,
  AgentDefinition,
} from "@kalphq/sdk";
import type { PersistenceAdapter } from "@/adapters/interfaces";
import type { EffectResolver } from "@/effects/types";
import type { LocalActions } from "@/effects/primitives";
import { ReplayLog } from "../state/replay-log";
import { createProxyContext } from "../effects/context";
import type { ExecutionFrame } from "../execution/frame";
import { handleEffect } from "./listener-dispatch";

/**
 * Builds a KalpContext for handler execution by composing the effect resolver,
 * replay log, execution frame, and agent metadata into a proxy context.
 *
 * @param resolver - The effect resolver for side effects.
 * @param log - The replay log for effect tracking.
 * @param frame - The current execution frame.
 * @param history - The agent's conversation history.
 * @param persistence - The persistence adapter for state and event storage.
 * @param ir - The agent's IR graph definition.
 * @param state - The current agent state.
 * @param localActions - The local actions primitive.
 * @returns A fully configured proxy KalpContext.
 */
export function buildHandlerContext(
  resolver: EffectResolver,
  log: ReplayLog,
  frame: ExecutionFrame,
  history: KalpHistory,
  persistence: PersistenceAdapter,
  ir: IRGraph,
  state: Record<string, unknown>,
  localActions: LocalActions,
): KalpContext {
  const agentDefinition: AgentDefinition = {
    name: ir.agent?.name ?? "unknown",
    description: ir.agent?.description,
    label: ir.agent?.label,
    tags: ir.agent?.tags,
    systemPrompt: typeof ir.agent?.systemPrompt === "object" && ir.agent.systemPrompt !== null
      ? (ir.agent.systemPrompt as { id?: string; version?: string })
      : undefined,
  };

  return createProxyContext(
    resolver,
    log,
    frame,
    (effect) => handleEffect(effect, persistence, ir),
    agentDefinition,
    history,
    state,
    localActions,
  );
}
