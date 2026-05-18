/**
 * ask() — human-in-the-loop action primitive.
 *
 * Sends a prompt to a human user and awaits a response.
 * The agent pauses execution until the human responds.
 *
 * Behavioral invariants:
 * - Pauses agent execution until response
 * - Validates response against schema if provided
 * - Supports timeout, defaultValue, and AbortSignal
 *
 * @module
 */

import type { z } from "zod";
import type { Duration } from "@/primitives/duration";

export interface AskOptions<T = unknown> {
  schema?: z.ZodType<T>;
  timeout?: Duration;
  signal?: AbortSignal;
  defaultValue?: T;
  metadata?: Record<string, unknown>;
}

export type AskAction = {
  /** Simple string prompt — returns the raw response as string. */
  (prompt: string): Promise<string>;

  /** Prompt with options — schema, timeout, signal, defaultValue. */
  <T>(prompt: string, options: AskOptions<T>): Promise<T>;
};
