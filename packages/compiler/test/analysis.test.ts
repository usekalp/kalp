import { describe, expect, it } from "vitest";
import { validateIR } from "../src/analysis";

describe("validateIR", () => {
  it("accepts v3 semantic IR with agent and state schema refs", () => {
    const result = validateIR({
      schemaVersion: 3,
      agent: {
        name: "support",
        label: "Support",
        tags: ["customer"],
        skipAuth: true,
        stateSchema: "schema_abc123",
      },
      nodes: {},
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});
