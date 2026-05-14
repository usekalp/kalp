import { defineAgent, defineContract, z } from "@kalphq/sdk";

export const supportContract = defineContract("customer_support", {
  input: z.any(),
  output: z.any(),
  emits: {
    ticket_created: z.object({
      ticketId: z.string(),
      priority: z.enum(["low", "high"]),
    }),
    refined_payload: z.string().refine((value) => value.length > 2),
    webhook_sent: "Webhook notification payload",
  },
});

export default defineAgent({
  name: "customer_support",
  tags: ["support", "inbox"],
  contract: supportContract,
  async onMessage() {
    return { text: "ok" };
  },
});
