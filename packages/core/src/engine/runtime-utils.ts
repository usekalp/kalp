import type { IRGraph } from "@kalphq/sdk";
import type { RuntimeEvent, EventDispatchEnvelope } from "./types";
import type { ReplayLog } from "../state/replay-log";

/**
 * Validates if a payload is a valid EventDispatchEnvelope.
 * Used for causal chain tracking in cross-agent event emissions.
 * 
 * @param payload - The payload to validate.
 * @returns True if the payload is an EventDispatchEnvelope.
 */
export function isDispatchEnvelope(payload: unknown): payload is EventDispatchEnvelope {
  if (!payload || typeof payload !== "object") return false;
  const value = payload as Record<string, unknown>;
  return (
    typeof value.eventName === "string" &&
    typeof value.traceId === "string" &&
    typeof value.parentExecutionId === "string"
  );
}

/**
 * Resolves the handler bundle hash from the IR graph based on the event type.
 * Maps high-level SDK hooks (onMessage, onInit, etc.) to their internal IR stable IDs.
 * 
 * @param eventType - The type of the event (e.g., "onMessage", "route:GET:/").
 * @param ir - The Intermediate Representation (IR) graph.
 * @returns The bundle hash if found, null otherwise.
 */
export function resolveHandlerHash(eventType: string, ir: IRGraph): string | null {
  let stableId = eventType;
  
  if (eventType === "onMessage") stableId = "hook:message";
  else if (eventType === "onCall") stableId = "hook:call";
  else if (eventType === "onInit") stableId = "hook:init";
  else if (eventType === "onTick") stableId = "hook:tick";
  else if (eventType.startsWith("route:")) stableId = eventType;
  else if (eventType.startsWith("listener:")) stableId = eventType;
  else if (eventType.startsWith("schedule:")) stableId = eventType.replace("schedule:", "cron:");
  else if (eventType.startsWith("steps.")) stableId = eventType.replace("steps.", "step:");
  else if (eventType.startsWith("tools.")) stableId = eventType.replace("tools.", "tool:");

  const node = ir.nodes[stableId];
  return node ? node.bundle : null;
}

/**
 * Calculates the starting sequence number for a new execution or resume.
 * Ensures that the sequence counter starts after the last persisted effect.
 * 
 * @param log - The replay log containing existing effects.
 * @param executionId - The unique execution identifier.
 * @returns The maximum sequence number found + 1, or 0 if none.
 */
export function calculateStartingSeq(
  log: ReplayLog,
  executionId: string,
): number {
  const events = log.getAll(executionId);
  if (!events) return 0;

  let maxSeq = 0;
  for (const event of events) {
    if (event && event.seq !== undefined) {
      maxSeq = Math.max(maxSeq, event.seq);
    }
  }
  return maxSeq > 0 ? maxSeq + 1 : 0;
}
