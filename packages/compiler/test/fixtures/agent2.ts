import { z } from "zod";
import { defineAgent, defineHook, defineTool } from "@kalphq/sdk";

export const stepB = defineTool({
  id: "tool_b",
  inputSchema: z.object({ text: z.string() }),
  async handler(input) {
    return { text: input.text };
  },
});

export default defineAgent({
  name: "agent-2",
  state: z.object({ ok: z.boolean().default(true) }),
  hooks: [
    defineHook({
      type: "message",
      async handler() {
        return {
          message: { role: "assistant" as const, content: "b" },
          done: true,
        };
      },
    }),
  ],
});
