import { describe, expect, it, expectTypeOf } from "vitest";
import { z } from "zod";
import { defineContract, defineListener, defineAgent } from "../src";

describe("defineListener", () => {
  it("infers payload from source contract emits", () => {
    const sourceContract = defineContract("source-agent", {
      input: z.object({}),
      output: z.object({ ok: z.boolean() }),
      emits: {
        ticket_created: z.object({
          ticketId: z.string(),
          priority: z.enum(["low", "high"]),
        }),
      },
    });

    const listener = defineListener({
      source: sourceContract,
      event: "ticket_created",
      async handler(payload) {
        expectTypeOf(payload).toEqualTypeOf<{
          ticketId: string;
          priority: "low" | "high";
        }>();
      },
    });

    const agent = defineAgent({
      name: "listener-agent",
      listeners: [listener],
      async onMessage() {
        return { text: "ok" };
      },
    });

    expect(agent.listeners).toHaveLength(1);
    expect(agent.listeners?.[0]?.event).toBe("ticket_created");
  });
});

