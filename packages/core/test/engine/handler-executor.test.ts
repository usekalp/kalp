import { describe, it, expect, vi } from "vitest";
import {
  executeHandlerBundle,
  resolveSystemPrompt,
} from "../../src/engine/handler-executor";
import { createFakeAdapters } from "../fixtures/fake-adapters";
import { ReplayLog } from "../../src/state/replay-log";
import { createRootFrame } from "../../src/execution/frame";
import type { PersistenceAdapter } from "../../src/adapters/interfaces";
import type { RuntimeEvent } from "../../src/engine/types";

describe("resolveSystemPrompt", () => {
  it("should return string prompt", () => {
    expect(resolveSystemPrompt({ agent: { name: "a", systemPrompt: "hello" } } as any)).toBe("hello");
  });

  it("should return empty for dynamic prompt", () => {
    expect(resolveSystemPrompt({ agent: { name: "a", systemPrompt: { dynamic: true } } } as any)).toBe("");
  });

  it("should return empty string when undefined", () => {
    expect(resolveSystemPrompt({ agent: { name: "a" } } as any)).toBe("");
  });
});

describe("executeHandlerBundle", () => {
  function createTestContext() {
    const adapters = createFakeAdapters();
    const persistence: PersistenceAdapter = {
      state: adapters.state, events: adapters.events,
      idempotency: adapters.state, threads: adapters.state,
    };
    const log = new ReplayLog();
    const frame = createRootFrame(
      { traceId: "t1", threadId: "th1", untrackedIOCount: 0, untrackedIOByType: { network: 0, timer: 0, fs: 0, unknown: 0 }, hasUntrustedPlugins: false },
      "exec-1", 0,
    );
    const resolver = { resolve: vi.fn().mockResolvedValue(undefined) } as any;
    const ir = { schemaVersion: 3, requirements: {}, agent: { name: "test" }, nodes: {} } as any;
    const bundleManifest = { schemaVersion: 3, targets: { default: { abiVersion: 1, nodes: {} } } } as any;
    return { adapters, persistence, log, frame, resolver, ir, bundleManifest };
  }

  it("should throw when bundle binding missing", async () => {
    const ctx = createTestContext();
    const event: RuntimeEvent = { type: "onMessage", payload: {}, threadId: "th1" };
    await expect(
      executeHandlerBundle("missing-node", event, ctx.frame, ctx.log, ctx.persistence, ctx.resolver, ctx.ir, {}, ctx.bundleManifest, async () => "", {}),
    ).rejects.toThrow("bundle binding missing");
  });

  it("should execute handler and return value", async () => {
    const ctx = createTestContext();
    ctx.bundleManifest.targets.default.nodes.node_msg = { bundle: "b1", file: "f.js", size: 0, format: "esm", entry: "default", sha256: "s1" };

    const event: RuntimeEvent = { type: "onMessage", payload: { x: 1 }, threadId: "th1" };
    const result = await executeHandlerBundle(
      "node_msg", event, ctx.frame, ctx.log, ctx.persistence, ctx.resolver, ctx.ir, {},
      ctx.bundleManifest,
      async () => "export default async (p) => ({ payload: p, extra: 42 })",
      {},
    );
    expect(result).toEqual({ value: { payload: { x: 1 }, extra: 42 } });
  });

  it("should execute context-only handler with undefined payload", async () => {
    const ctx = createTestContext();
    ctx.bundleManifest.targets.default.nodes.node_init = { bundle: "b2", file: "f.js", size: 0, format: "esm", entry: "default", sha256: "s2" };

    const event: RuntimeEvent = { type: "onInit", payload: {}, threadId: "th1" };
    const result = await executeHandlerBundle(
      "node_init", event, ctx.frame, ctx.log, ctx.persistence, ctx.resolver, ctx.ir, {},
      ctx.bundleManifest,
      async () => "export default async (_p, ctx) => ({ started: ctx.runtime.runId })",
      {},
    );
    expect(result).toEqual({ value: { started: "exec-1" } });
  });

  it("should handle SuspensionException", async () => {
    const ctx = createTestContext();
    ctx.bundleManifest.targets.default.nodes.node_msg = { bundle: "b3", file: "f.js", size: 0, format: "esm", entry: "default", sha256: "s3" };
    ctx.resolver.resolve.mockImplementation(async (effect: any) => {
      if (effect.type === "action.waitUntil") {
        throw { constructor: { name: "SuspensionException" }, resumeAt: 999, wakeReason: "timer", seq: 0 };
      }
      return undefined;
    });

    // We need to actually import SuspensionException and throw it from the effect
    const { SuspensionException } = await import("../../src/engine/suspension");
    ctx.resolver.resolve.mockImplementation(async (effect: any) => {
      if (effect.type === "action.waitUntil") {
        throw new SuspensionException(999, "timer", {}, 0);
      }
      return undefined;
    });

    const event: RuntimeEvent = { type: "onMessage", payload: {}, threadId: "th1" };
    const result = await executeHandlerBundle(
      "node_msg", event, ctx.frame, ctx.log, ctx.persistence, ctx.resolver, ctx.ir, {},
      ctx.bundleManifest,
      async () => "export default async (_p, ctx) => { await ctx.actions.waitUntil(999); return 'done'; }",
      {},
    );
    expect(result).toEqual({ suspended: true, until: 999, wakeReason: "timer" });
  });
});
