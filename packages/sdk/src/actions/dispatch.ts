/**
 * dispatch() — fire-and-forget action primitive.
 *
 * Enqueues a listener invocation without awaiting its result.
 * Returns a DispatchReceipt on successful enqueue.
 * Rejects the promise if enqueue fails (routing, persistence, etc.).
 *
 * Behavioral invariants:
 * - Fire-and-forget
 * - Returns DispatchReceipt { eventId } on success
 * - Rejects promise on enqueue failure
 * - Non-blocking
 * - No delivery guarantee after acceptance
 *
 * @module
 */

import type { z } from "zod";
import type { Listener } from "@/listeners/types";

export interface DispatchReceipt {
  eventId: string;
}

export interface ListenerDispatchOptions {
  idempotencyKey?: string;
  signal?: AbortSignal;
}

export type DispatchAction = <TListener extends Listener<any, any, any>>(
  listener: TListener,
  payload: z.infer<TListener["inputSchema"]>,
  options?: ListenerDispatchOptions,
) => Promise<DispatchReceipt>;
