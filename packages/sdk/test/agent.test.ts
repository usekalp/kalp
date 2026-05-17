import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  defineAgent,
  defineRoute,
  defineContract,
  defineHook,
  defineCron,
  everySixHours,
} from "../src";
import { createMockContext } from "./shared";

describe("defineAgent", () => {
  const stateSchema = z.object({
    status: z.enum(["idle", "processing"]).default("idle"),
    processedCount: z.number().default(0),
  });

  it("returns declarative config with state", () => {
    const agent = defineAgent({
      name: "test-agent",
      state: stateSchema,
      hooks: [
        defineHook({
          type: "message",
          async handler(message) {
            return { text: message.text };
          },
        }),
      ],
    });

    expect(agent.name).toBe("test-agent");
    expect(agent.state).toBe(stateSchema);
  });

  it("supports hooks, routes, contracts, and cron", () => {
    const route = defineRoute({
      id: "health",
      method: "GET",
      path: "/health",
      async handler() {
        return { ok: true };
      },
    });

    const contract = defineContract({
      name: "sales-bot",
      inputSchema: z.object({ leadId: z.string() }),
      outputSchema: z.object({ score: z.number() }),
      async handler() {
        return { score: 95 };
      },
    });

    const cron = defineCron({
      expression: everySixHours,
      timezone: "UTC",
      async handler() {},
    });

    const agent = defineAgent({
      name: "sales-agent",
      state: stateSchema,
      routes: [route],
      contracts: [contract],
      cron: [cron],
      hooks: [
        defineHook({ type: "init", async handler() {} }),
        defineHook({ type: "tick", async handler() {} }),
        defineHook({
          type: "message",
          async handler(message) {
            return { text: message.text };
          },
        }),
      ],
    });

    expect(agent.routes).toHaveLength(1);
    expect(agent.contracts).toHaveLength(1);
    expect(agent.cron).toHaveLength(1);
    expect(agent.hooks).toHaveLength(3);
  });

  it("supports systemPrompt as function", async () => {
    const mockContext = createMockContext();
    const agent = defineAgent({
      name: "dynamic-prompt-agent",
      state: stateSchema,
      async systemPrompt(context) {
        const custom = await context.vault.get("PROMPT" as never);
        return `You are ${custom}`;
      },
      hooks: [
        defineHook({
          type: "message",
          async handler(message) {
            return { text: message.text };
          },
        }),
      ],
    });

    if (typeof agent.systemPrompt === "function") {
      const prompt = await agent.systemPrompt(mockContext as any);
      expect(prompt).toBe("You are secret-value");
    }
  });
});
