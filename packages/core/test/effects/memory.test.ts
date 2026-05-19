import { describe, it, expect } from "vitest";
import { createMemoryContext } from "../../src/effects/primitives/memory";
import { createInterceptorMock } from "../helpers/interceptor-mock";

describe("createMemoryContext", () => {
  it("should append message via memory.append", async () => {
    const { interceptEffect, calls } = createInterceptorMock();
    const memory = createMemoryContext(interceptEffect);
    await memory.append({ role: "user", content: "hello" });
    expect(calls[0]).toMatchObject({
      type: "memory.append",
      payload: { content: "hello", role: "user" },
    });
  });

  it("should list memory items via memory.list", async () => {
    const { interceptEffect, calls } = createInterceptorMock({
      "memory.list": () => ({ items: [{ role: "assistant", content: "hi", timestamp: 1 }], nextCursor: undefined }),
    });
    const memory = createMemoryContext(interceptEffect);
    const result = await memory.list({ limit: 10 });
    expect(calls[0]).toMatchObject({ type: "memory.list", payload: { limit: 10 } });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.content).toBe("hi");
  });

  it("should list with default empty result", async () => {
    const { interceptEffect } = createInterceptorMock({
      "memory.list": () => ({ items: [], nextCursor: undefined }),
    });
    const memory = createMemoryContext(interceptEffect);
    const result = await memory.list();
    expect(result.items).toEqual([]);
  });

  it("should summarize via memory.summarize", async () => {
    const { interceptEffect, calls } = createInterceptorMock({
      "memory.summarize": () => "summary text",
    });
    const memory = createMemoryContext(interceptEffect);
    const result = await memory.summarize();
    expect(calls[0]).toMatchObject({ type: "memory.summarize" });
    expect(result).toBe("summary text");
  });
});
