import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  defineRoute,
  defineFlow,
  defineAgent,
  defineConfig,
  asAgentId,
  asUserId,
  defineStep,
  defineTool,
} from "../src";
import type {
  HandlerContext,
  KalpAI,
  KalpMemory,
  KalpVault,
  KalpAuth,
  KalpActions,
} from "../src/types";

// Create properly typed mock context (flattened — no ctx.ctx nesting)
const createMockContext = (): HandlerContext => ({
  ai: { generate: vi.fn(), stream: vi.fn(), classify: vi.fn() } as KalpAI,
  memory: {
    list: vi.fn(),
    append: vi.fn(),
    summarize: vi.fn(),
  } as KalpMemory,
  vault: {
    get: vi.fn().mockResolvedValue("secret-value"),
  } as KalpVault,
  storage: {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  auth: {
    userId: asUserId("u-1"),
    claims: {},
    hasPermission: vi.fn(),
  } as KalpAuth,
  actions: {
    run: vi.fn(),
    wait: vi.fn(),
    loop: vi.fn(),
    fetch: vi.fn(),
  } as unknown as KalpActions,
});

describe("SDK Core Tests", () => {
  describe("context surface", () => {
    it("exposes loop action and classify", () => {
      const ctx = createMockContext();
      expect(typeof ctx.actions.loop).toBe("function");
      expect(typeof ctx.ai.classify).toBe("function");
    });
  });

  describe("defineConfig", () => {
    it("returns config unchanged", () => {
      const config = defineConfig({
        secrets: ["OPENAI_API_KEY"],
      });
      expect(config).toEqual({ secrets: ["OPENAI_API_KEY"] });
    });

    it("handles empty secrets", () => {
      const config = defineConfig({ secrets: [] });
      expect(config.secrets).toEqual([]);
    });
  });

  describe("defineStep", () => {
    it("attaches kind step", () => {
      const step = defineStep({
        id: "step_1",
        inputSchema: z.object({ value: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        async run(params: { value: string }) {
          return { result: params.value.toUpperCase() };
        },
      });

      expect(step.kind).toBe("step");
      expect(step.id).toBe("step_1");
      expect(step.inputSchema).toBeDefined();
      expect(step.outputSchema).toBeDefined();
      expect("run" in step).toBe(true);
    });
  });

  describe("defineTool", () => {
    it("attaches kind tool", () => {
      const tool = defineTool({
        id: "tool_1",
        inputSchema: z.object({ query: z.string() }),
        async execute(params: { query: string }) {
          return { out: params.query };
        },
      });

      expect(tool.kind).toBe("tool");
      expect(tool.id).toBe("tool_1");
      expect(tool.inputSchema).toBeDefined();
      expect("execute" in tool).toBe(true);
    });

    it("supports optional description", () => {
      const toolWithDesc = defineTool({
        id: "tool_desc",
        description: "A helpful tool",
        inputSchema: z.object({}),
        async execute() {
          return {};
        },
      });

      const toolWithoutDesc = defineTool({
        id: "tool_no_desc",
        inputSchema: z.object({}),
        async execute() {
          return {};
        },
      });

      expect(toolWithDesc.description).toBe("A helpful tool");
      expect(toolWithoutDesc.description).toBeUndefined();
    });
  });

  describe("defineRoute", () => {
    it("attaches kind route", () => {
      const route = defineRoute({
        id: "health",
        method: "GET",
        path: "/health",
        handler: async () => ({ ok: true }),
      });

      expect(route.kind).toBe("route");
      expect(route.id).toBe("health");
      expect(route.path).toBe("/health");
      expect(route.method).toBe("GET");
      expect("handler" in route).toBe(true);
    });

    it("supports all HTTP methods", () => {
      const methods = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

      for (const method of methods) {
        const route = defineRoute({
          id: `route-${method.toLowerCase()}`,
          method,
          path: `/test`,
          handler: async () => {},
        });

        expect(route.method).toBe(method);
      }
    });

    it("supports input schema", () => {
      const route = defineRoute({
        id: "create-user",
        method: "POST",
        path: "/users",
        inputSchema: z.object({
          name: z.string(),
          email: z.string().email(),
        }),
        handler: async () => ({ created: true }),
      });

      expect(route.inputSchema).toBeDefined();
    });
  });

  describe("defineFlow", () => {
    it("attaches kind flow", () => {
      const flow = defineFlow({
        id: "test-flow",
        steps: [],
      });

      expect(flow.kind).toBe("flow");
      expect(flow.id).toBe("test-flow");
    });

    it("preserves step references", () => {
      const step = defineStep({
        id: "s1",
        inputSchema: z.object({}),
        outputSchema: z.object({ ok: z.boolean() }),
        async run(_params: Record<string, never>) {
          return { ok: true };
        },
      });

      const flow = defineFlow({
        id: "flow_1",
        steps: [step],
      });

      expect(flow.steps).toHaveLength(1);
      expect(flow.steps[0]?.id).toBe("s1");
    });

    it("handles empty step array", () => {
      const flow = defineFlow({
        id: "empty-flow",
        description: "A flow with no steps",
        steps: [],
      });

      expect(flow.steps).toHaveLength(0);
    });
  });

  describe("defineAgent", () => {
    it("returns config with components", () => {
      const step = defineStep({
        id: "s1",
        inputSchema: z.object({ text: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        async run(params: { text: string }) {
          return { result: params.text };
        },
      });

      const tool = defineTool({
        id: "t1",
        inputSchema: z.object({ q: z.string() }),
        async execute(params: { q: string }) {
          return { q: params.q };
        },
      });

      const agent = defineAgent({
        id: asAgentId("agent-1"),
        name: "Agent 1",
        steps: [step],
        tools: [tool],
        async onMessage(ctx: any) {
          return { text: ctx.message.text };
        },
      });

      expect(agent.id).toBe("agent-1");
      expect(agent.steps?.[0]?.id).toBe("s1");
      expect(agent.tools?.[0]?.id).toBe("t1");
    });

    it("supports onMessage with flattened context", async () => {
      const mockContext = createMockContext();

      const agent = defineAgent({
        id: asAgentId("test-agent"),
        name: "Test Agent",
        async onMessage(ctx: any) {
          const secret = await ctx.vault.get("KEY" as never);
          return { text: `${ctx.message.text} - ${secret}` };
        },
      });

      const result = await agent.onMessage({
        message: { text: "hello", senderId: asUserId("u-1") },
        history: [],
        state: {},
        ...mockContext,
      });

      expect(result).toEqual({ text: "hello - secret-value" });
    });

    it("supports systemPrompt as string", () => {
      const agent = defineAgent({
        id: asAgentId("static-prompt"),
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
        id: asAgentId("dynamic-prompt-agent"),
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
        id: asAgentId("lifecycle-agent"),
        name: "Lifecycle Agent",
        onInit: async (_ctx: HandlerContext) => {},
        onTick: async (_ctx: HandlerContext) => {},
        async onMessage(ctx: any) {
          return { text: ctx.message.text };
        },
      });

      expect(agent.onInit).toBeDefined();
      expect(agent.onTick).toBeDefined();
      expect(agent.onMessage).toBeDefined();
    });

    it("supports all agent options", () => {
      const step = defineStep({
        id: "step-1",
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        async run(_params: Record<string, never>) {
          return {};
        },
      });

      const tool = defineTool({
        id: "tool-1",
        inputSchema: z.object({}),
        async execute(_params: Record<string, never>) {
          return {};
        },
      });

      const route = defineRoute({
        id: "route-1",
        method: "GET",
        path: "/test",
        handler: async () => {},
      });

      const flow = defineFlow({
        id: "flow-1",
        steps: [step],
      });

      const agent = defineAgent({
        id: asAgentId("full-agent"),
        name: "Full Agent",
        description: "An agent with everything",
        version: 1,
        steps: [step],
        tools: [tool],
        routes: [route],
        flows: [flow],
        async onMessage(ctx: any) {
          return { text: ctx.message.text };
        },
      });

      expect(agent.steps).toHaveLength(1);
      expect(agent.tools).toHaveLength(1);
      expect(agent.routes).toHaveLength(1);
      expect(agent.flows).toHaveLength(1);
      expect(agent.description).toBe("An agent with everything");
      expect(agent.version).toBe(1);
    });
  });

  describe("Type helpers", () => {
    it("asAgentId keeps original value", () => {
      expect(asAgentId("a-1")).toBe("a-1");
      expect(asAgentId("my-agent")).toBe("my-agent");
    });

    it("asUserId keeps original value", () => {
      expect(asUserId("u-1")).toBe("u-1");
      expect(asUserId("user@example.com")).toBe("user@example.com");
    });
  });
});
