import { z } from "zod";
import { defineStep, defineAgent } from "@kalphq/sdk";

export const stepA = defineStep({
  id: "step_a",
  inputSchema: z.object({}),
  outputSchema: z.object({}),
  async handler() { return {}; }
});

export default defineAgent({ name: "agent-1" });
