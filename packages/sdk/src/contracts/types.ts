import { AgentId } from "@/identity";
import type { z } from "zod";

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
export interface AgentContract<
  TInput extends z.ZodTypeAny = z.ZodTypeAny,
  TOutput extends z.ZodTypeAny = z.ZodTypeAny,
> {
  readonly kind: "contract";
  readonly agentId: AgentId;
  readonly inputSchema: TInput;
  readonly outputSchema: TOutput;
  readonly onCall: {
    input: TInput;
    output: TOutput;
  };
}

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
>(
  agentId: string,
  contract: {
    input: TInput;
    output: TOutput;
  },
): AgentContract<TInput, TOutput> {
  return {
    kind: "contract",
    agentId: agentId as AgentId,
    inputSchema: contract.input,
    outputSchema: contract.output,
    onCall: {
      input: contract.input,
      output: contract.output,
    },
  };
}
