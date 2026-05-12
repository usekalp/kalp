import { z } from "zod";
import { defineAgent, defineContract } from "@kalphq/sdk";

const sourceContract = defineContract("source-agent", {
  input: z.object({}),
  output: z.object({ ok: z.boolean() }),
  emits: {
    ticket_created: z.object({
      ticketId: z.string(),
    }),
  },
});

export const onTicketCreated = {
  source: sourceContract,
  event: "ticket_created",
  async handler(payload) {
    void payload.ticketId;
  },
};

export default defineAgent({
  name: "listener-agent",
  public: true,
  listeners: [onTicketCreated],
  async onMessage() {
    return { text: "ok" };
  },
});
