import { describe, expect, expectTypeOf, it, beforeEach } from "vitest";
import { z } from "zod";
import {
  defineListener,
  getRegistry,
  clearRegistry,
  type TypedKalpContext,
} from "../src";

describe("defineListener", () => {
  beforeEach(() => {
    clearRegistry();
  });

  it("creates a local listener with typed input/output", () => {
    const listener = defineListener({
      event: "ticket_created",
      inputSchema: z.object({
        ticketId: z.string(),
        priority: z.enum(["low", "high"]),
      }),
      outputSchema: z.object({ accepted: z.boolean() }),
      async handler(
        payload: { ticketId: string; priority: "low" | "high" },
        ctx: TypedKalpContext<{ processedCount: number }>,
      ) {
        expectTypeOf(payload).toEqualTypeOf<{
          ticketId: string;
          priority: "low" | "high";
        }>();
        expectTypeOf(ctx.state).toEqualTypeOf<{ processedCount: number }>();
        return { accepted: payload.priority === "high" };
      },
    });

    expect(listener.event).toBe("ticket_created");
    expect(listener.kind).toBe("listener");
    expect(getRegistry().has("listeners.ticket_created")).toBe(true);
  });
});
