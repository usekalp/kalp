import { describe, it, expect, vi } from "vitest";
import { ReplayLog } from "../../src/state/replay-log";
import { createRootFrame } from "../../src/execution/frame";
import {
  createInterceptEffect,
  createInterceptLocalEffect,
  createInterceptSync,
} from "../../src/effects/interceptors";
import type { EffectResolver, Effect, EffectType, EffectMap } from "../../src/effects/types";
import type { PersistedEffect } from "../../src/state/replay-log";

function createTestContext() {
  const log = new ReplayLog();
  const frame = createRootFrame(
    { traceId: "t1", threadId: "th1", untrackedIOCount: 0, untrackedIOByType: { network: 0, timer: 0, fs: 0, unknown: 0 }, hasUntrustedPlugins: false },
    "exec-1",
    0,
  );

  const resolved: PersistedEffect[] = [];
  const onEffectResolved = vi.fn(async (effect: PersistedEffect) => {
    resolved.push(effect);
    log.append(effect);
  });

  const resolver: EffectResolver = {
    resolve: vi.fn(async <T extends EffectType>(effect: Effect<T>): Promise<EffectMap[T]["result"]> => {
      if (effect.type === "ai.generate") return { text: "hello" } as EffectMap[T]["result"];
      if (effect.type === "action.ask") return "yes" as EffectMap[T]["result"];
      throw new Error("unexpected effect");
    }),
  };

  return { log, frame, resolver, onEffectResolved, resolved };
}

describe("createInterceptEffect", () => {
  it("should call resolver on cache miss", async () => {
    const ctx = createTestContext();
    const intercept = createInterceptEffect(ctx.resolver, ctx.log, ctx.frame, ctx.onEffectResolved);

    const result = await intercept("ai.generate", { prompt: "hi" });
    expect(result).toEqual({ text: "hello" });
    expect(ctx.resolver.resolve).toHaveBeenCalledTimes(1);
    expect(ctx.onEffectResolved).toHaveBeenCalledTimes(1);
  });

  it("should replay cached result on cache hit", async () => {
    const ctx = createTestContext();
    ctx.log.append({
      seq: 0,
      type: "ai.generate",
      payload: { prompt: "hi" },
      executionId: "exec-1",
      traceId: "t1",
      threadId: "th1",
      timestamp: Date.now(),
      result: { text: "hello" },
    });
    const intercept = createInterceptEffect(ctx.resolver, ctx.log, ctx.frame, ctx.onEffectResolved);
    const result = await intercept("ai.generate", { prompt: "hi" });
    expect(result).toEqual({ text: "hello" });
    expect(ctx.resolver.resolve).not.toHaveBeenCalled();
  });

  it("should replay cached error on cache hit", async () => {
    const ctx = createTestContext();
    ctx.log.append({
      seq: 0,
      type: "ai.generate",
      payload: { prompt: "hi" },
      executionId: "exec-1",
      traceId: "t1",
      threadId: "th1",
      timestamp: Date.now(),
      error: { message: "cached error", name: "Error" },
    });
    const intercept = createInterceptEffect(ctx.resolver, ctx.log, ctx.frame, ctx.onEffectResolved);

    await expect(intercept("ai.generate", { prompt: "hi" })).rejects.toThrow("cached error");
  });

  it("should propagate error and persist it", async () => {
    const ctx = createTestContext();
    ctx.resolver.resolve = vi.fn().mockRejectedValue(new Error("effect failed"));
    const intercept = createInterceptEffect(ctx.resolver, ctx.log, ctx.frame, ctx.onEffectResolved);

    await expect(intercept("ai.generate", { prompt: "hi" })).rejects.toThrow("effect failed");
    expect(ctx.onEffectResolved).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ message: "effect failed" }) }),
    );
  });
});

describe("createInterceptLocalEffect", () => {
  it("should execute and cache result", async () => {
    const ctx = createTestContext();
    const intercept = createInterceptLocalEffect(ctx.resolver, ctx.log, ctx.frame, ctx.onEffectResolved);

    const result = await intercept("action.call", { contract: "svc", input: {} }, async () => "ok");
    expect(result).toBe("ok");
    const result2 = await intercept("action.call", { contract: "svc", input: {} }, async () => "ok");
    expect(result2).toBe("ok");
  });

  it("should return result from execute on new call", async () => {
    const ctx = createTestContext();
    const intercept = createInterceptLocalEffect(ctx.resolver, ctx.log, ctx.frame, ctx.onEffectResolved);

    const result = await intercept("action.call", { contract: "svc", input: {} }, async () => "new");
    expect(result).toBe("new");
  });
});

describe("createInterceptSync", () => {
  it("should execute compute and return result", () => {
    const ctx = createTestContext();
    const intercept = createInterceptSync(ctx.resolver, ctx.log, ctx.frame, ctx.onEffectResolved);

    const result = intercept("math.add", { a: 1, b: 2 }, () => 3);
    expect(result).toBe(3);
  });

  it("should replay cached result", () => {
    const ctx = createTestContext();
    ctx.log.append({
      seq: 0,
      type: "math.add",
      payload: { a: 1, b: 2 },
      executionId: "exec-1",
      traceId: "t1",
      threadId: "th1",
      timestamp: Date.now(),
      result: 3,
    });

    const intercept = createInterceptSync(ctx.resolver, ctx.log, ctx.frame, ctx.onEffectResolved);
    const compute = vi.fn(() => 99);
    const result = intercept("math.add", { a: 1, b: 2 }, compute);
    expect(result).toBe(3);
    expect(compute).not.toHaveBeenCalled();
  });
});
