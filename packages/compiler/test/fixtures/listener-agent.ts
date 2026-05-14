import { z } from "zod";
import { defineAgent, defineContract, defineListener } from "@kalphq/sdk";

const sourceContract = defineContract("source-agent", {
  input: z.object({}),
  output: z.object({ ok: z.boolean() }),
  emits: {
    ticket_created: z.object({
      ticketId: z.string(),
    }),
  },
});

export const onTicketCreated = defineListener({
  source: sourceContract,
  event: "ticket_created",
  async handler(payload) {
    void payload.ticketId;
  },
});

export default defineAgent({
  name: "listener-agent",
  skipAuth: true,
  listeners: [onTicketCreated],
  async onMessage() {
    return { text: "ok" };
  },
});
