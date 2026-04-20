import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  createStep,
  createTool,
  defineRoute,
  defineFlow,
  defineAgent,
  defineConfig,
  asAgentId,
  asUserId,
} from "../src";
import type {
  HandlerContext,
  Step,
  Tool,
  KalpAI,
  KalpMemory,
  KalpVault,
  KalpAuth,
} from "../src/types";

// Create properly typed mock context
const createMockContext = (): HandlerContext => ({
  ctx: {
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
  },
  actions: {
    ai: { generate: vi.fn(), stream: vi.fn() } as KalpAI,
    wait: vi.fn(),
    fetch: vi.fn(),
    runStep: vi.fn(),
    callTool: vi.fn(),
    runFlow: vi.fn(),
  },
});

describe("SDK Core Tests", () => {
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

  describe("createStep", () => {
    it("attaches kind step", () => {
      const step = createStep({
        id: "step_1",
        input: z.object({ value: z.string() }),
        output: z.object({ result: z.string() }),
        async run(params: { value: string }) {
          return { result: params.value.toUpperCase() };
        },
      });

      expect(step.kind).toBe("step");
      expect(step.id).toBe("step_1");
    });

    it("executes run handler", async () => {
      const step = createStep({
        id: "test_step",
        input: z.object({ num: z.number() }),
        output: z.object({ doubled: z.number() }),
        async run(params: { num: number }) {
          return { doubled: params.num * 2 };
        },
      });

      const result = await step.run({ num: 5 }, createMockContext());
      expect(result.doubled).toBe(10);
    });

    it("can access vault in handler", async () => {
      const mockContext = createMockContext();
      const mockGet = vi.fn().mockResolvedValue("api-key-123");
      mockContext.ctx.vault.get = mockGet;

      const step = createStep({
        id: "vault_step",
        input: z.object({}),
        output: z.object({ key: z.string() }),
        async run(_params: Record<string, never>, context: HandlerContext) {
          const key = await context.ctx.vault.get("API_KEY" as never);
          return { key };
        },
      });

      const result = await step.run({}, mockContext);
      expect(result.key).toBe("api-key-123");
      expect(mockGet).toHaveBeenCalledWith("API_KEY");
    });

    it("can use actions in handler", async () => {
      const mockContext = createMockContext();
      const mockFetch = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ data: "fetched" }),
      });
      mockContext.actions.fetch = mockFetch;

      const step = createStep({
        id: "fetch_step",
        input: z.object({ url: z.string() }),
        output: z.object({ data: z.string() }),
        async run(params: { url: string }, context: HandlerContext) {
          const res = await context.actions.fetch(params.url);
          const json = await res.json();
          return { data: json.data };
        },
      });

      const result = await step.run(
        { url: "https://api.test.com" },
        mockContext,
      );
      expect(result.data).toBe("fetched");
      expect(mockFetch).toHaveBeenCalledWith("https://api.test.com");
    });
  });

  describe("createTool", () => {
    it("attaches kind tool", () => {
      const tool = createTool({
        id: "tool_1",
        input: z.object({ query: z.string() }),
        async execute(params: { query: string }) {
          return { out: params.query };
        },
      });

      expect(tool.kind).toBe("tool");
      expect(tool.id).toBe("tool_1");
    });

    it("executes execute handler", async () => {
      const tool = createTool({
        id: "test_tool",
        input: z.object({ q: z.string() }),
        async execute(params: { q: string }) {
          return { result: params.q.toLowerCase() };
        },
      });

      const result = await tool.execute({ q: "HELLO" }, createMockContext());
      expect(result.result).toBe("hello");
    });

    it("supports optional description", () => {
      const toolWithDesc = createTool({
        id: "tool_desc",
        description: "A helpful tool",
        input: z.object({}),
        async execute() {
          return {};
        },
      });

      const toolWithoutDesc = createTool({
        id: "tool_no_desc",
        input: z.object({}),
        async execute() {
          return {};
        },
      });

      expect(toolWithDesc.description).toBe("A helpful tool");
      expect(toolWithoutDesc.description).toBeUndefined();
    });
  });

  describe("defineRoute", () => {
    it("preserves route shape", () => {
      const route = defineRoute({
        id: "health",
        method: "GET",
        path: "/health",
        handler: async () => ({ ok: true }),
      });

      expect(route.id).toBe("health");
      expect(route.path).toBe("/health");
      expect(route.method).toBe("GET");
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
        input: z.object({
          name: z.string(),
          email: z.string().email(),
        }),
        handler: async () => ({ created: true }),
      });

      expect(route.input).toBeDefined();
    });
  });

  describe("defineFlow", () => {
    it("preserves step references", () => {
      const step = createStep({
        id: "s1",
        input: z.object({}),
        output: z.object({ ok: z.boolean() }),
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
      const step = createStep({
        id: "s1",
        input: z.object({ text: z.string() }),
        output: z.object({ result: z.string() }),
        async run(params: { text: string }) {
          return { result: params.text };
        },
      });

      const tool = createTool({
        id: "t1",
        input: z.object({ q: z.string() }),
        async execute(params: { q: string }) {
          return { q: params.q };
        },
      });

      const agent = defineAgent({
        id: asAgentId("agent-1"),
        name: "Agent 1",
        steps: [step],
        tools: [tool],
        async onMessage(params: { message: { text: string } }) {
          return { text: params.message.text };
        },
      });

      expect(agent.id).toBe("agent-1");
      expect(agent.steps?.[0]?.id).toBe("s1");
      expect(agent.tools?.[0]?.id).toBe("t1");
    });

    it("supports onMessage with new signature", async () => {
      const mockContext = createMockContext();
      const mockRunStep = vi.fn().mockResolvedValue({ result: "step-output" });
      mockContext.actions.runStep = mockRunStep;

      const agent = defineAgent({
        id: asAgentId("test-agent"),
        name: "Test Agent",
        async onMessage(params: {
          message: { text: string };
          ctx: HandlerContext["ctx"];
          actions: HandlerContext["actions"];
        }) {
          const { message, ctx, actions } = params;
          const secret = await ctx.vault.get("KEY" as never);
          return { text: `${message.text} - ${secret}` };
        },
      });

      const result = await agent.onMessage!({
        message: { text: "hello", senderId: asUserId("u-1") },
        ...mockContext,
      });

      expect(result).toEqual({ text: "hello - secret-value" });
    });

    it("supports systemPrompt as string", () => {
      const agent = defineAgent({
        id: asAgentId("static-prompt"),
        name: "Static Prompt",
        systemPrompt: "You are a helpful assistant.",
        async onMessage(params: { message: { text: string } }) {
          return { text: params.message.text };
        },
      });

      expect(agent.systemPrompt).toBe("You are a helpful assistant.");
    });

    it("supports systemPrompt as function", async () => {
      const mockContext = createMockContext();
      const mockGet = vi.fn().mockResolvedValue("dynamic-prompt");
      mockContext.ctx.vault.get = mockGet;

      const agent = defineAgent({
        id: asAgentId("dynamic-prompt-agent"),
        name: "Dynamic Prompt",
        async systemPrompt(context: HandlerContext) {
          const custom = await context.ctx.vault.get("PROMPT" as never);
          return `You are ${custom}`;
        },
        async onMessage(params: { message: { text: string } }) {
          return { text: params.message.text };
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
        async onMessage(params: { message: { text: string } }) {
          return { text: params.message.text };
        },
      });

      expect(agent.onInit).toBeDefined();
      expect(agent.onTick).toBeDefined();
      expect(agent.onMessage).toBeDefined();
    });

    it("supports all agent options", () => {
      const step = createStep({
        id: "step-1",
        input: z.object({}),
        output: z.object({}),
        async run(_params: Record<string, never>) {
          return {};
        },
      });

      const tool = createTool({
        id: "tool-1",
        input: z.object({}),
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
        async onMessage(params: { message: { text: string } }) {
          return { text: params.message.text };
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
