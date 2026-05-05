import { z } from "zod";
import { defineStep, defineAgent } from "@kalphq/sdk";

export const stepB = defineStep({
  id: "step_b",
  inputSchema: z.object({}),
  outputSchema: z.object({}),
  async handler() { return {}; }
});

export default defineAgent({ name: "agent-2" });
