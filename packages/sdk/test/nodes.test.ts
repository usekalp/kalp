import { describe, expect, it, beforeEach } from "vitest";
import { z } from "zod";
import { defineStep, defineTool, getRegistry, clearRegistry } from "../src";

describe("defineStep", () => {
  beforeEach(() => {
    clearRegistry();
  });

  it("attaches kind step", () => {
    const step = defineStep({
      id: "step_1",
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ result: z.string() }),
      async handler(params: { value: string }) {
        return { result: params.value.toUpperCase() };
      },
    });

    expect(step.kind).toBe("step");
    expect(step.id).toBe("step_1");
    expect(step.inputSchema).toBeDefined();
    expect(step.outputSchema).toBeDefined();
    expect("handler" in step).toBe(true);
  });

  it("registers in global registry", () => {
    defineStep({
      id: "registered-step",
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      async handler() {
        return {};
      },
    });

    const registry = getRegistry();
    expect(registry.has("steps.registered-step")).toBe(true);
  });
});

describe("defineTool", () => {
  beforeEach(() => {
    clearRegistry();
  });

  it("attaches kind tool", () => {
    const tool = defineTool({
      id: "tool_1",
      inputSchema: z.object({ query: z.string() }),
      async handler(params: { query: string }) {
        return { out: params.query };
      },
    });

    expect(tool.kind).toBe("tool");
    expect(tool.id).toBe("tool_1");
    expect(tool.inputSchema).toBeDefined();
    expect("handler" in tool).toBe(true);
  });

  it("supports optional description", () => {
    const toolWithDesc = defineTool({
      id: "tool_desc",
      description: "A helpful tool",
      inputSchema: z.object({}),
      async handler() {
        return {};
      },
    });

    const toolWithoutDesc = defineTool({
      id: "tool_no_desc",
      inputSchema: z.object({}),
      async handler() {
        return {};
      },
    });

    expect(toolWithDesc.description).toBe("A helpful tool");
    expect(toolWithoutDesc.description).toBeUndefined();
  });

  it("registers in global registry", () => {
    defineTool({
      id: "registered-tool",
      inputSchema: z.object({}),
      async handler() {
        return {};
      },
    });

    const registry = getRegistry();
    expect(registry.has("tools.registered-tool")).toBe(true);
  });
});
