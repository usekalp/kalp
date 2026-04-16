import { createStep } from "@kalphq/sdk";
import { z } from "zod";

export const exampleStep = createStep({
  id: "example_step",
  description: "A stub step — replace with your own logic.",
  input: z.object({ message: z.string() }),
  output: z.object({ result: z.string() }),
  async run({ message }, ctx) {
    ctx.logger.info("Running example step", { message });
    return { result: `Processed: ${message}` };
  },
});
