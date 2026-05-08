import { z } from "zod";
import {
  defineStep,
  defineTool,
  defineAgent,
  defineContract,
  defineRoute,
} from "@kalphq/sdk";

// Contract for external agent communication
export const externalAgentContract = defineContract("external-agent", {
  input: z.object({
    query: z.string(),
    context: z.record(z.unknown()).optional(),
  }),
  output: z.object({ result: z.string(), confidence: z.number().optional() }),
});

// Contract for internal step communication
export const internalContract = defineContract("internal-step", {
  input: z.object({ data: z.string() }),
  output: z.object({ processed: z.string(), timestamp: z.number() }),
});

// Step that uses a contract for type-safe communication
export const contractStep = defineStep({
  id: "contract_step",
  inputSchema: z.object({ payload: z.string() }),
  outputSchema: z.object({ validated: z.boolean() }),
  async handler(input, ctx) {
    // Validate input using contract logic
    const validated = input.payload.length > 0;
    return { validated };
  },
});

// Step that simulates calling another agent
export const agentCallerStep = defineStep({
  id: "agent_caller",
  inputSchema: z.object({ query: z.string() }),
  outputSchema: z.object({ response: z.string() }),
  async handler(input, ctx) {
    // This would use ctx.actions.callAgent in real implementation
    // For now, just simulate the contract-based communication
    const mockResponse = `Processed: ${input.query}`;
    return { response: mockResponse };
  },
});

// Tool that processes data with contract validation
export const contractTool = defineTool({
  id: "contract_tool",
  inputSchema: z.object({ raw: z.string() }),
  async handler(input, ctx) {
    // Validate and transform input
    const valid = input.raw.length > 0;
    return { valid, transformed: valid ? input.raw.toUpperCase() : null };
  },
});

// Route for contract-based API
export const contractRoute = defineRoute({
  id: "POST:/api/contract",
  method: "POST",
  path: "/api/contract",
  async handler(req, res, ctx) {
    // Simulate contract-based request/response
    return { processed: true, contract: "external-agent" };
  },
});

// Agent with contracts - include steps/tools so they register
export default defineAgent({
  name: "contracts-test-agent",
  description: "An agent that tests contract definitions",
  contract: externalAgentContract,
  routes: [contractRoute],
  async onMessage(message, ctx) {
    return { text: "contract agent ready" };
  },
  async onCall(input, ctx) {
    // Simulate RPC handling with contract types
    return { result: "contract call handled", confidence: 0.95 };
  },
});
