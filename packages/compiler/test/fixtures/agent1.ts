import { z } from "zod";
import { defineAgent, defineHook, defineTool } from "@kalphq/sdk";

export const stepA = defineTool({
  id: "tool_a",
  inputSchema: z.object({ text: z.string() }),
  async handler(input) {
    return { text: input.text };
  },
});

export default defineAgent({
  name: "agent-1",
  state: z.object({ ok: z.boolean().default(true) }),
  hooks: [
    defineHook({
      type: "message",
      async handler() {
        return {
          message: { role: "assistant" as const, content: "a" },
          done: true,
        };
      },
    }),
  ],
});
