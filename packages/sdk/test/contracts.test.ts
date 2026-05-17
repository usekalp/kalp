import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod";
import { defineContract } from "../src";

describe("defineContract", () => {
  it("creates a contract with kind and name", () => {
    const contract = defineContract({
      name: "test-agent",
      inputSchema: z.object({ query: z.string() }),
      outputSchema: z.object({ result: z.string() }),
      async handler(input) {
        return { result: input.query };
      },
    });

    expect(contract.kind).toBe("contract");
    expect(contract.name).toBe("test-agent");
  });

  it("stores input/output schemas and infers handler types", async () => {
    const inputSchema = z.object({ value: z.number() });
    const outputSchema = z.object({ doubled: z.number() });

    const contract = defineContract<{ processedCount: number }>({
      name: "math-agent",
      inputSchema,
      outputSchema,
      async handler(input, ctx) {
        expectTypeOf(input).toEqualTypeOf<{ value: number }>();
        expectTypeOf(ctx.state).toEqualTypeOf<{ processedCount: number }>();
        return { doubled: input.value * 2 };
      },
    });

    expect(contract.inputSchema).toBe(inputSchema);
    expect(contract.outputSchema).toBe(outputSchema);
  });
});
