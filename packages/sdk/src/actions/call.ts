/**
 * call() — request/response action primitive.
 *
 * Invokes a listener and awaits its output.
 * Typed via the listener's outputSchema.
 *
 * Behavioral invariants:
 * - Exactly one response
 * - Typed output
 * - Propagates errors
 * - Request/response semantics
 *
 * @module
 */

import type { z } from "zod";
import type { Listener } from "@/listeners/types";

export interface ListenerCallOptions {
  idempotencyKey?: string;
  timeout?: number;
  signal?: AbortSignal;
}

export type CallAction = <TListener extends Listener<any, any, any>>(
  listener: TListener,
  payload: z.infer<TListener["inputSchema"]>,
  options?: ListenerCallOptions,
) => Promise<z.infer<TListener["outputSchema"]>>;
