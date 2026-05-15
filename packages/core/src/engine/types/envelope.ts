/**
 * Event dispatch envelope for cross-agent messaging.
 *
 * @module
 */

/**
 * Envelope propagated across asynchronous event dispatch boundaries.
 * Used to preserve causal traceability when an emit wakes listener handlers.
 */
export interface EventDispatchEnvelope {
  eventName: string;
  payload: unknown;
  traceId: string;
  parentExecutionId: string;
  sourceAgentId?: string;
}