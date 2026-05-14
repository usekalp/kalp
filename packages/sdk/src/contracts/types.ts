import { AgentId } from "@/identity";
import type { z } from "zod";
import type { Simplify } from "@/utils/types";

/**
 * Contract types for type-safe RPC between agents.
 *
 * @module
 */

/**
 * A contract defining the input/output interface for an agent.
 * Used for type-safe RPC between agents without circular dependencies.
 *
 * Create contracts with {@link defineContract} in a shared file,
 * then import them in both caller and receiver agents.
 */
export type AgentContract<
  TInput extends z.ZodTypeAny = z.ZodTypeAny,
  TOutput extends z.ZodTypeAny = z.ZodTypeAny,
  TEmits extends Record<string, any> = {},
> = Simplify<{
  readonly kind: "contract";
  readonly agentId: AgentId;
  readonly inputSchema: TInput;
  readonly outputSchema: TOutput;
  readonly onCall: {
    input: TInput;
    output: TOutput;
  };
  readonly emits?: TEmits;
}>;

/**
 * Extracts the emission schemas from an AgentContract.
 */
export type EmitsOf<T> = T extends AgentContract<any, any, infer E> ? E : {};

/**
 * Defines a contract for an agent that can be called via RPC.
 *
 * @param agentId - The unique identifier for this agent contract.
 * @param contract - The input/output schemas defining the contract.
 * @returns A contract object for use with `callAgent` and `defineAgent`.
 *
 * @example
 * ```typescript
 * export const SalesBotContract = defineContract("sales-bot", {
 *   input: z.object({ leadId: z.string() }),
 *   output: z.object({ score: z.number(), reason: z.string() })
 * });
 * ```
 */
export function defineContract<
  const TInput extends z.ZodTypeAny,
  const TOutput extends z.ZodTypeAny,
  const TEmits extends Record<string, any> = {},
>(
  agentId: string,
  contract: {
    input: TInput;
    output: TOutput;
    emits?: TEmits;
  },
): AgentContract<TInput, TOutput, TEmits> {
  return {
    kind: "contract",
    agentId: agentId as AgentId,
    inputSchema: contract.input,
    outputSchema: contract.output,
    onCall: {
      input: contract.input,
      output: contract.output,
    },
    emits: contract.emits,
  };
}
