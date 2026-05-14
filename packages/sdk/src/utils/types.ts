import type { z } from "zod";
import type { Step, Tool } from "@/nodes/types";

/**
 * Type utility helpers for the Kalp SDK.
 *
 * @module
 */

/**
 * Extracts the input type from a Step or Tool.
 */
export type InputOf<T> =
  T extends Step<infer I, any>
    ? z.infer<I>
    : T extends Tool<infer I, any>
      ? z.infer<I>
      : never;

/**
 * Extracts the output type from a Step or Tool.
 */
export type OutputOf<T> =
  T extends Step<any, infer O>
    ? z.infer<O>
    : T extends Tool<any, infer R>
      ? R
      : never;

/**
 * Flattens complex intersections and types into a simple object structure.
 * This is crucial for IDE performance and readable hover types.
 */
export type Simplify<T> = {
  [K in keyof T]: T[K];
} & {};
