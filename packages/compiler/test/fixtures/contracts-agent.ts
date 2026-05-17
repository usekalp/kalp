import { z } from "zod";
import {
  defineAgent,
  defineContract,
  defineHook,
  defineTool,
  defineRoute,
} from "@kalphq/sdk";

export const stateSchema = z.object({ processedCount: z.number().default(0) });

export const approvalContract = defineContract<z.infer<typeof stateSchema>>({
  name: "approval-service",
  inputSchema: z.object({ opportunityId: z.string() }),
  outputSchema: z.object({ approved: z.boolean() }),
  async handler(input) {
    return { approved: input.opportunityId.length > 0 };
  },
});

export const contractTool = defineTool<z.infer<typeof stateSchema>>({
  id: "contract_tool",
  inputSchema: z.object({ payload: z.string() }),
  async handler(input) {
    return { validated: input.payload.length > 0 };
  },
});

export const contractRoute = defineRoute({
  id: "contract_route",
  method: "POST",
  path: "/api/contract",
  inputSchema: z.object({ ok: z.boolean() }),
  async handler({ body }) {
    return { echoed: body?.ok ?? false };
  },
});

export const messageHook = defineHook({
  type: "message",
  async handler(message) {
    return { text: message.text };
  },
});

export default defineAgent({
  name: "contracts-test-agent",
  state: stateSchema,
  contracts: [approvalContract],
  routes: [contractRoute],
  hooks: [messageHook],
});
