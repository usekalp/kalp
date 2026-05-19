import type { PersistenceAdapter } from "@/adapters/interfaces";
import type { ExecutionFrame } from "../execution/frame";
import { validateStateSchema } from "./schema-utils";

/**
 * Key used to persist agent state in the state store.
 */
export const AGENT_STATE_STORAGE_KEY = "__kalp_state__";

/**
 * Loads the agent state from the persistence adapter.
 * Returns an empty object if no state is stored or the stored value is invalid.
 *
 * @param persistence - The persistence adapter for state storage.
 * @returns The loaded agent state as a flat record.
 */
export async function loadAgentState(
  persistence: PersistenceAdapter,
): Promise<Record<string, unknown>> {
  const stored = await persistence.state.get(AGENT_STATE_STORAGE_KEY);
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) {
    return {};
  }

  return JSON.parse(JSON.stringify(stored)) as Record<string, unknown>;
}

/**
 * Validates the agent state against its schema, persists it to the state store,
 * and appends a state.write event to the event log.
 *
 * @param stateSchema - An optional JSON schema for state validation.
 * @param state - The state to persist.
 * @param frame - The current execution frame (used for event metadata).
 * @param persistence - The persistence adapter for state and event storage.
 * @throws If state validation fails.
 */
export async function persistValidatedState(
  stateSchema: Record<string, unknown> | undefined,
  state: Record<string, unknown>,
  frame: ExecutionFrame,
  persistence: PersistenceAdapter,
): Promise<void> {
  const errors = validateStateSchema(stateSchema, state, "state");
  if (errors.length > 0) {
    throw new Error(`State validation failed: ${errors.join("; ")}`);
  }

  await persistence.state.set(AGENT_STATE_STORAGE_KEY, state);
  await persistence.events.append({
    type: "state.write",
    key: AGENT_STATE_STORAGE_KEY,
    value: state,
    executionId: frame.executionId,
    traceId: frame.ctx.traceId,
    threadId: frame.ctx.threadId,
    timestamp: Date.now(),
  });
}
