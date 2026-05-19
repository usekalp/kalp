import { describe, it, expect, beforeEach } from "vitest";
import { KalpRuntime } from "../../src/engine/runtime";
import { createFakeAdapters } from "../fixtures/fake-adapters";
import { FakeEffectResolver } from "../fixtures/fake-resolver";
import type { PersistenceAdapter } from "../../src/adapters/interfaces";
import type { RuntimeEvent } from "../../src/engine/types";

describe("factory-to-runtime integration", () => {
  let adapters: ReturnType<typeof createFakeAdapters>;
  let persistence: PersistenceAdapter;
  let resolver: FakeEffectResolver;

  beforeEach(() => {
    adapters = createFakeAdapters();
    persistence = { state: adapters.state, events: adapters.events, idempotency: adapters.state, threads: adapters.state };
    resolver = new FakeEffectResolver(adapters.events, adapters.state, adapters.scheduler);
  });

  it("should execute handler end-to-end with effect resolution", async () => {
    const runtime = new KalpRuntime(
      {
        schemaVersion: 3,
        requirements: { "kalp/state": 1, "kalp/listeners": 1 },
        agent: { name: "test" },
        nodes: {
          n_msg: {
            id: "n_msg", stableName: "hook.message", kind: "message",
            trigger: { type: "message" },
          },
        },
      },
      {},
      {
        schemaVersion: 3,
        targets: { default: { abiVersion: 1, nodes: { n_msg: { bundle: "b1", file: "f.js", size: 0, format: "esm", entry: "default", sha256: "s1" } } } },
      },
      async () => "export default async (p, ctx) => { ctx.state.count = (ctx.state.count ?? 0) + 1; return { count: ctx.state.count }; }",
      persistence,
      resolver,
    );

    const event: RuntimeEvent = { type: "onMessage", payload: {}, threadId: "th1" };
    const result = await runtime.handleEvent(event);
    expect(result).toEqual({ count: 1 });
  });
});
