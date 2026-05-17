import { z } from "zod";
import { defineAgent, defineHook, defineListener } from "@kalphq/sdk";

export const stateSchema = z.object({ processedCount: z.number().default(0) });

export const onTicketCreated = defineListener<z.infer<typeof stateSchema>>({
  event: "ticket_created",
  inputSchema: z.object({ ticketId: z.string() }),
  outputSchema: z.object({ consumed: z.boolean() }),
  async handler(payload, ctx) {
    ctx.state.processedCount += 1;
    return { consumed: Boolean(payload.ticketId) };
  },
});

export default defineAgent({
  name: "listener-agent",
  state: stateSchema,
  hooks: [
    defineHook<z.infer<typeof stateSchema>>({
      type: "message",
      async handler(message, ctx) {
        const result = await ctx.actions.emit(onTicketCreated, { ticketId: message.text });
        return { text: result.consumed ? "ok" : "fail" };
      },
    }),
  ],
});
