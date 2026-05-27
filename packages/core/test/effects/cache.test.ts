import { describe, it, expect, vi } from "vitest";
import { createCacheContext } from "../../src/effects/primitives/cache";

function createMockInterceptor() {
  const calls: Array<{ type: string; payload: unknown }> = [];
  const intercept = vi.fn(async (type: string, payload: unknown) => {
    calls.push({ type, payload });
    if (type === "cache.get") return (payload as { key: string }).key === "found" ? "value" : null;
    return undefined;
  });
  return { intercept, calls };
}

describe("createCacheContext", () => {
  it("calls interceptor with cache.get and key", async () => {
    const { intercept, calls } = createMockInterceptor();
    const cache = createCacheContext(intercept);

    const result = await cache.get("found");

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({ type: "cache.get", payload: { key: "found" } });
    expect(result).toBe("value");
  });

  it("returns null for cache.get on missing key", async () => {
    const { intercept } = createMockInterceptor();
    const cache = createCacheContext(intercept);

    const result = await cache.get("missing");

    expect(result).toBeNull();
  });

  it("calls interceptor with cache.set, key and value", async () => {
    const { intercept, calls } = createMockInterceptor();
    const cache = createCacheContext(intercept);

    await cache.set("my-key", { count: 42 });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({ type: "cache.set", payload: { key: "my-key", value: { count: 42 } } });
  });

  it("calls interceptor with cache.delete and key", async () => {
    const { intercept, calls } = createMockInterceptor();
    const cache = createCacheContext(intercept);

    await cache.delete("old-key");

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({ type: "cache.delete", payload: { key: "old-key" } });
  });
});