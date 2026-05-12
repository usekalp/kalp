import { describe, expect, it } from "vitest";
import { z } from "zod";
import { defineContract } from "../src";

describe("defineContract", () => {
  it("creates a contract with kind", () => {
    const contract = defineContract("test-agent", {
      input: z.object({ query: z.string() }),
      output: z.object({ result: z.string() }),
    });

    expect(contract.kind).toBe("contract");
    expect(contract.agentId).toBe("test-agent");
  });

  it("stores input and output schemas", () => {
    const inputSchema = z.object({ value: z.number() });
    const outputSchema = z.object({ doubled: z.number() });

    const contract = defineContract("math-agent", {
      input: inputSchema,
      output: outputSchema,
    });

    expect(contract.inputSchema).toBe(inputSchema);
    expect(contract.outputSchema).toBe(outputSchema);
  });

  it("has onCall type metadata", () => {
    const contract = defineContract("api-agent", {
      input: z.object({}),
      output: z.object({}),
    });

    expect(contract.onCall.input).toBeDefined();
    expect(contract.onCall.output).toBeDefined();
  });

  it("supports emits declaration on contract", () => {
    const contract = defineContract("events-agent", {
      input: z.object({}),
      output: z.object({ ok: z.boolean() }),
      emits: {
        ping: z.object({ id: z.string() }),
      },
    });

    expect(contract.emits?.ping).toBeDefined();
  });
});
