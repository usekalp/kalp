import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod";
import {
  defineAgent,
  defineContract,
  everyDayAtNoon,
  everyDayAt12Pm,
  cron,
  type CronExpression,
} from "../src";

describe("agent DX typing", () => {
  it("infers onCall input from contract and types emit in handlers", async () => {
    const RevenueContract = defineContract("revenue", {
      input: z.object({
        opportunityId: z.string(),
      }),
      output: z.object({
        accepted: z.boolean(),
      }),
      emits: {
        approval_requested: z.object({
          opportunityId: z.string(),
        }),
      },
    });
    const handoffCompletedSchema = z.object({
      opportunityId: z.string(),
      success: z.boolean(),
    });
    const agent = defineAgent({
      name: "revenue-agent",
      contract: RevenueContract,
      emits: {
        handoff_completed: handoffCompletedSchema,
      },
      cron: [
        {
          expression: everyDayAtNoon,
          timezone: "Europe/London",
          handler: async () => {},
        },
      ],
      async onInit(ctx) {
        ctx.actions.emit("approval_requested", { opportunityId: "opp_1" });
      },
      async onCall(input, ctx) {
        expectTypeOf(input).toEqualTypeOf<{ opportunityId: string }>();
        ctx.actions.emit("approval_requested", {
          opportunityId: input.opportunityId,
        });
        ctx.actions.emit("handoff_completed", {
          opportunityId: input.opportunityId,
          success: true,
        });
        // @ts-expect-error unknown event must fail
        ctx.actions.emit("unknown_event", {});
        // @ts-expect-error payload mismatch must fail
        ctx.actions.emit("approval_requested", { bad: true });

        return { accepted: true };
      },
    });

    const onCallInput = {} as Parameters<NonNullable<typeof agent.onCall>>[0];
    expectTypeOf(onCallInput).toEqualTypeOf<{ opportunityId: string }>();
    expect(agent.cron?.[0]?.expression).toBe(everyDayAtNoon);
  });

  it("accepts cron expressions with five fields", () => {
    const everySixHours = cron("0 */6 * * *");
    expectTypeOf(everySixHours).toEqualTypeOf<CronExpression>();
    expect(everyDayAt12Pm).toBe(everyDayAtNoon);
    const invalid: CronExpression = "every day at noon";
    expect(invalid).toBeDefined();
  });
});
