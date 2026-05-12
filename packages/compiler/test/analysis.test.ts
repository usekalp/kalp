import { describe, expect, it } from "vitest";
import { validateIR } from "../src/analysis";

describe("validateIR metadata extensions", () => {
  it("accepts label, tags and emits structures", () => {
    const result = validateIR({
      metadata: {
        name: "support",
        label: "Support",
        tags: ["customer"],
        emits: {
          ticket_created: {
            type: "schema",
            schema: { type: "object" },
          },
          note: {
            type: "description",
            description: "event description",
          },
        },
      },
      entries: {},
      bundles: {},
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});
