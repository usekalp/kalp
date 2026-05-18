import { defineAgent, defineContract, defineHook, z } from "@kalphq/sdk";

export const supportContract = defineContract({
  name: "customer_support",
  inputSchema: z.object({ message: z.string() }),
  outputSchema: z.object({ ok: z.boolean() }),
  async handler() {
    return { ok: true };
  },
});

export const messageHook = defineHook({
  type: "message",
  async handler() {
    return { message: { role: "assistant" as const, content: "ok" }, done: true };
  },
});

export default defineAgent({
  name: "customer_support",
  state: z.object({}),
  tags: ["support", "inbox"],
  contracts: [supportContract],
  hooks: [messageHook],
});
