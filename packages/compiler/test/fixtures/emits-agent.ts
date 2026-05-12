import { z } from "zod";
import { defineAgent } from "@kalphq/sdk";

export default defineAgent({
  name: "customer_support",
  tags: ["support", "inbox"],
  emits: {
    ticket_created: z.object({
      ticketId: z.string(),
      priority: z.enum(["low", "high"]),
    }),
    refined_payload: z.string().refine((value) => value.length > 2),
    webhook_sent: "Webhook notification payload",
  },
  async onMessage() {
    return { text: "ok" };
  },
});
