import { createStep } from "@kalphq/sdk";
import { z } from "zod";

export const transformData = createStep({
  id: "transform_data",
  description: "Transforms input data to a standardized format.",
  input: z.object({
    data: z.record(z.unknown()),
    format: z.string(), // "json", "csv", "xml"
  }),
  output: z.object({
    transformed: z.boolean(),
    result: z.record(z.unknown()),
    format: z.string(),
  }),
  async run({ data, format }) {
    // Simple transformation example
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
      // Normalize keys to snake_case
      const normalizedKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
      result[normalizedKey] = value;
    }

    return {
      transformed: true,
      result,
      format: format.toLowerCase(),
    };
  },
});
