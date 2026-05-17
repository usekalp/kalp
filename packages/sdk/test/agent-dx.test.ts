import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod";
import {
  defineAgent,
  defineContract,
  defineHook,
  defineListener,
  defineCron,
  everyDayAtNoon,
  everyDayAt12Pm,
  cron,
  type CronExpression,
  type TypedKalpContext,
} from "../src";

type RevenueState = {
  status: "idle" | "processing";
  processedCount: number;
  lastOpportunity?: string;
};

describe("agent DX typing", () => {
  it("infers contract, listener, and state types by reference", async () => {
    const approvalRequested = defineListener({
      event: "approval_requested",
      inputSchema: z.object({ opportunityId: z.string(), score: z.number() }),
      outputSchema: z.object({ approved: z.boolean() }),
      async handler(
        payload: { opportunityId: string; score: number },
        ctx: TypedKalpContext<RevenueState>,
      ) {
        expectTypeOf(payload).toEqualTypeOf<{
          opportunityId: string;
          score: number;
        }>();
        expectTypeOf(ctx.state).toEqualTypeOf<RevenueState>();
        ctx.state.processedCount += 1;
        return { approved: payload.score > 80 };
      },
    });

    const approvalContract = defineContract({
      name: "approval-service",
      inputSchema: z.object({ opportunityId: z.string() }),
      outputSchema: z.object({ approved: z.boolean() }),
      async handler(
        input: { opportunityId: string },
        ctx: TypedKalpContext<RevenueState>,
      ) {
        expectTypeOf(input).toEqualTypeOf<{ opportunityId: string }>();
        expectTypeOf(ctx.state).toEqualTypeOf<RevenueState>();
        return { approved: Boolean(input.opportunityId) };
      },
    });

    const messageHook = defineHook<RevenueState>({
      type: "message",
      async handler(
        message: { text: any },
        ctx: TypedKalpContext<RevenueState>,
      ) {
        expectTypeOf(ctx.state).toEqualTypeOf<RevenueState>();
        const emitted = await ctx.actions.emit(approvalRequested, {
          opportunityId: message.text,
          score: 91,
        });
        expectTypeOf(emitted).toEqualTypeOf<{ approved: boolean }>();
        await ctx.actions.dispatch(approvalRequested, {
          opportunityId: message.text,
          score: 50,
        });
        const result = await ctx.actions.callAgent(approvalContract, {
          opportunityId: message.text,
        });
        expectTypeOf(result).toEqualTypeOf<{ approved: boolean }>();
        return { text: result.approved ? "approved" : "rejected" };
      },
    });

    const stateSchema = z.object({
      status: z.enum(["idle", "processing"]).default("idle"),
      processedCount: z.number().default(0),
      lastOpportunity: z.string().optional(),
    });

    const agent = defineAgent({
      name: "revenue-agent",
      state: stateSchema,
      contracts: [approvalContract],
      cron: [
        defineCron<RevenueState>({
          expression: everyDayAtNoon,
          timezone: "Europe/London",
          async handler(ctx: TypedKalpContext<RevenueState>) {
            expectTypeOf(ctx.state).toEqualTypeOf<RevenueState>();
          },
        }),
      ],
      hooks: [messageHook],
    });

    expect(agent.cron?.[0]?.expression).toBe(everyDayAtNoon);
  });

  it("accepts cron expressions with five fields", () => {
    const everySixHours = cron("0 */6 * * *");
    expect(typeof everySixHours).toBe("string");
    expect(everyDayAt12Pm).toBe(everyDayAtNoon);
    const invalid: CronExpression = "every day at noon";
    expect(invalid).toBeDefined();
  });

  it("allows defining multiple hooks", () => {
    const stateSchema = z.object({ processedCount: z.number().default(0) });

    defineAgent({
      name: "multi-hook-agent",
      state: stateSchema,
      hooks: [
        defineHook({
          type: "message",
          async handler() {
            return { text: "a" };
          },
        }),
        defineHook({
          type: "init",
          async handler() {},
        }),
      ],
    });

    expect(true).toBe(true);
  });
});
