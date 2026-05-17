import { z } from "zod";
import { defineAgent, defineHook, defineTool } from "@kalphq/sdk";

export const tool1 = defineTool({
  id: "duplicate_tool",
  inputSchema: z.object({}),
  async handler() {
    return { ok: true };
  },
});

export const tool2 = defineTool({
  id: "duplicate_tool",
  inputSchema: z.object({}),
  async handler() {
    return { ok: false };
  },
});

export default defineAgent({
  name: "duplicate-tools-agent",
  state: z.object({ ok: z.boolean().default(true) }),
  hooks: [defineHook({ type: "message", async handler() { return { text: "dup" }; } })],
});
