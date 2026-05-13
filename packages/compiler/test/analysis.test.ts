import { describe, expect, it } from "vitest";
import { validateIR } from "../src/analysis";

describe("validateIR metadata extensions", () => {
  it("accepts label, tags and emits structures", () => {
    const result = validateIR({
      version: 1,
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
        public: true,
        routesPublic: {
          "GET:/health": false,
          "POST:/webhook": true,
        },
        listeners: [
          {
            sourceAgentId: "source-agent",
            event: "ticket_created",
            targetEntryKey: "listener:source-agent:ticket_created:0",
          },
        ],
      },
      entries: {},
      bundles: {},
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});
