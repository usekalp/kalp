import { describe, expect, it, beforeEach } from "vitest";
import { z } from "zod";
import { defineListener, defineTool, getRegistry, clearRegistry } from "../src";

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

  it("supports optional description and registry autodiscovery", () => {
    const tool = defineTool({
      id: "registered-tool",
      description: "A helpful tool",
      inputSchema: z.object({}),
      async handler() {
        return {};
      },
    });

    expect(tool.description).toBe("A helpful tool");
    expect(getRegistry().has("tools.registered-tool")).toBe(true);
  });
});

describe("listener registry", () => {
  beforeEach(() => {
    clearRegistry();
  });

  it("registers listeners in the global registry", () => {
    defineListener({
      event: "approval_requested",
      inputSchema: z.object({ id: z.string() }),
      outputSchema: z.object({ approved: z.boolean() }),
      async handler() {
        return { approved: true };
      },
    });

    expect(getRegistry().has("listeners.approval_requested")).toBe(true);
  });
});
