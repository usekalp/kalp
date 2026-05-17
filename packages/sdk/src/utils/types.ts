import type { z } from "zod";
import type { Tool } from "@/nodes/types";

/**
 * Type utility helpers for the Kalp SDK.
 *
 * @module
 */

/**
 * Extracts the input type from a Tool.
 */
export type InputOf<T> = T extends Tool<infer I, any, any, any> ? z.infer<I> : never;

/**
 * Extracts the output type from a Tool.
 * Infers from outputSchema when present, otherwise falls back to handler return type.
 */
export type OutputOf<T> = T extends Tool<any, infer O, any, infer OSchema>
  ? OSchema extends z.ZodTypeAny
    ? z.infer<OSchema>
    : O
  : never;

/**
 * Flattens complex intersections and types into a simple object structure.
 * This is crucial for IDE performance and readable hover types.
 */
export type Simplify<T> = {
  [K in keyof T]: T[K];
} & {};
