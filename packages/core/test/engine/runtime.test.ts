import { describe, it, expect, vi } from "vitest";
import { KalpRuntime } from "../../src/engine/runtime";
import type { IRGraph } from "@kalphq/sdk";

function mockPersistence(overrides = {}) {
  return {
    events: {
      loadByThread: vi.fn().mockResolvedValue([]),
      loadByTrace: vi.fn().mockResolvedValue([]),
      loadAll: vi.fn().mockResolvedValue([]),
      append: vi.fn(),
    },
    state: {
      load: vi.fn().mockResolvedValue(null),
      save: vi.fn(),
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      increment: vi.fn(),
      list: vi.fn(),
      batch: vi.fn(),
    },
    idempotency: { get: vi.fn(), set: vi.fn() },
    threads: { getMeta: vi.fn(), setMeta: vi.fn() },
    ...overrides,
  };
}

function mockResolver() {
  return { resolve: vi.fn() };
}

function mockManifest(overrides = {}) {
  return { schemaVersion: 3 as const, targets: { default: { abiVersion: 1, nodes: {} } }, ...overrides };
}

const mockIR: IRGraph = {
  schemaVersion: 3 as const,
  agent: { name: "test" },
  nodes: {},
};

function mockBundleLoader() {
  return vi.fn();
}

describe("KalpRuntime constructor", () => {
  it("throws on schemaVersion !== 3", () => {
    expect(() => new KalpRuntime(
      { schemaVersion: 2 as const, agent: { name: "test" }, nodes: {} } as unknown as IRGraph,
      {},
      mockManifest(),
      mockBundleLoader(),
      mockPersistence(),
      mockResolver(),
    )).toThrow("IR incompatible");
  });

  it("throws on missing targets.default", () => {
    expect(() => new KalpRuntime(
      mockIR,
      {},
      { targets: {} } as never,
      mockBundleLoader(),
      mockPersistence(),
      mockResolver(),
    )).toThrow("missing targets.default");
  });

  it("throws on wrong ABI version", () => {
    expect(() => new KalpRuntime(
      mockIR,
      {},
      { targets: { default: { abiVersion: 2 } } } as never,
      mockBundleLoader(),
      mockPersistence(),
      mockResolver(),
    )).toThrow("Unsupported runtime ABI");
  });
});

describe("KalpRuntime handleEvent", () => {
  it("throws on unknown event type with no nodeId", async () => {
    const runtime = new KalpRuntime(
      mockIR,
      {},
      mockManifest(),
      mockBundleLoader(),
      mockPersistence(),
      mockResolver(),
    );
    await expect(runtime.handleEvent({
      type: "unknown" as never,
      timestamp: Date.now(),
      threadId: "t1",
    } as never)).rejects.toThrow("No handler found");
  });
});
