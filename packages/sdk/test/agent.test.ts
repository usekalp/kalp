import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { defineAgent, defineRoute, defineContract } from "../src";
import { createMockContext } from "./shared";
import type { HandlerContext } from "../src";

describe("defineAgent", () => {
  it("returns config with name", () => {
    const agent = defineAgent({
      name: "Test Agent",
      async onMessage(ctx: HandlerContext) {
        return { text: ctx.message.text };
      },
    });

    expect(agent.name).toBe("Test Agent");
  });

  it("supports onMessage with flattened context", async () => {
    const mockContext = createMockContext();

    const agent = defineAgent({
      name: "Test Agent",
      async onMessage(ctx: any) {
        const secret = await ctx.vault.get("KEY" as never);
        return { text: `${ctx.message.text} - ${secret}` };
      },
    });

    const result = await agent.onMessage({
      message: { text: "hello", senderId: "u-1" as any },
      history: [],
      state: {},
      ...mockContext,
    });

    expect(result).toEqual({ text: "hello - secret-value" });
  });

  it("supports systemPrompt as string", () => {
    const agent = defineAgent({
      name: "Static Prompt",
      systemPrompt: "You are a helpful assistant.",
      async onMessage(ctx: any) {
        return { text: ctx.message.text };
      },
    });

    expect(agent.systemPrompt).toBe("You are a helpful assistant.");
  });

  it("supports systemPrompt as function", async () => {
    const mockContext = createMockContext();
    const mockGet = vi.fn().mockResolvedValue("dynamic-prompt");
    mockContext.vault.get = mockGet;

    const agent = defineAgent({
      name: "Dynamic Prompt",
      async systemPrompt(context: HandlerContext) {
        const custom = await context.vault.get("PROMPT" as never);
        return `You are ${custom}`;
      },
      async onMessage(ctx: any) {
        return { text: ctx.message.text };
      },
    });

    if (typeof agent.systemPrompt === "function") {
      const prompt = await agent.systemPrompt(mockContext);
      expect(prompt).toBe("You are dynamic-prompt");
    }
  });

  it("supports all lifecycle hooks", () => {
    const agent = defineAgent({
      name: "Lifecycle Agent",
      onInit: async () => {},
      onTick: async () => {},
      async onMessage(ctx: any) {
        return { text: ctx.message.text };
      },
    });

    expect(agent.onInit).toBeDefined();
    expect(agent.onTick).toBeDefined();
    expect(agent.onMessage).toBeDefined();
  });

  it("supports routes", () => {
    const route = defineRoute({
      id: "health",
      method: "GET",
      path: "/health",
      handler: async () => ({ ok: true }),
    });

    const agent = defineAgent({
      name: "Agent with Routes",
      routes: [route],
      async onMessage(ctx: any) {
        return { text: ctx.message.text };
      },
    });

    expect(agent.routes).toHaveLength(1);
    expect(agent.routes?.[0]?.id).toBe("health");
  });

  it("supports contract for RPC", () => {
    const SalesContract = defineContract("sales-bot", {
      input: z.object({ leadId: z.string() }),
      output: z.object({ score: z.number() }),
    });

    const agent = defineAgent({
      name: "Sales Bot",
      contract: SalesContract,
      async onCall(input: { leadId: string }, _ctx: HandlerContext) {
        return { score: 95 };
      },
    });

    expect(agent.contract).toBeDefined();
    expect(agent.name).toBe("Sales Bot");
  });

  it("supports label, tags and emits metadata", () => {
    const agent = defineAgent({
      name: "customer_support",
      label: "Customer Support",
      tags: ["support", "tier-1"],
      emits: {
        ticket_created: z.object({ id: z.string() }),
        note: "Human escalation event",
      },
      async onMessage(ctx: any) {
        return { text: ctx.message.text };
      },
    });

    expect(agent.label).toBe("Customer Support");
    expect(agent.tags).toEqual(["support", "tier-1"]);
    expect(agent.emits).toBeDefined();
    expect(Object.keys(agent.emits ?? {})).toEqual(["ticket_created", "note"]);
  });
});
