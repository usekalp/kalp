import { z } from "zod";
import { defineStep, defineAgent } from "@kalphq/sdk";

export const step1 = defineStep({
  id: "duplicate_id",
  inputSchema: z.object({}),
  outputSchema: z.object({}),
  async handler() { return {}; }
});

export const step2 = defineStep({
  id: "duplicate_id",
  inputSchema: z.object({}),
  outputSchema: z.object({}),
  async handler() { return {}; }
});

export default defineAgent({
  name: "duplicate-agent",
  onMessage: async () => ({ text: "ok" })
});
