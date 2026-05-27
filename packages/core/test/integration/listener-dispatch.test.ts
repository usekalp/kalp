import { describe, it, expect, beforeEach } from "vitest";
import { KalpRuntime } from "../../src/engine/runtime";
import { createFakeAdapters } from "../fixtures/fake-adapters";
import { FakeEffectResolver } from "../fixtures/fake-resolver";
import type { PersistenceAdapter } from "../../src/adapters/interfaces";

describe("listener dispatch integration", () => {
  let adapters: ReturnType<typeof createFakeAdapters>;
  let persistence: PersistenceAdapter;
  let resolver: FakeEffectResolver;

  beforeEach(() => {
    adapters = createFakeAdapters();
    persistence = {
      state: adapters.state,
      events: adapters.events,
      idempotency: adapters.state,
      threads: adapters.state,
    };
    resolver = new FakeEffectResolver(
      adapters.events,
      adapters.state,
      adapters.scheduler,
    );
  });

  it("should queue a dispatch event via ctx.actions.dispatch", async () => {
    const runtime = new KalpRuntime(
      {
        schemaVersion: 3,
        agent: { name: "test" },
        nodes: {
          n_msg: {
            id: "n_msg",
            stableName: "hook.message",
            kind: "message",
            trigger: { type: "message" },
          },
          n_listener: {
            id: "n_listener",
            stableName: "listener.event_x",
            kind: "listener",
            trigger: { type: "listener", event: "event_x" },
            listener: { event: "event_x" },
          },
        },
      },
      {},
      {
        schemaVersion: 3,
        targets: {
          default: {
            abiVersion: 1,
            nodes: {
              n_msg: {
                bundle: "b1",
                file: "f.js",
                size: 0,
                format: "esm",
                entry: "default",
                sha256: "s1",
              },
              n_listener: {
                bundle: "b1",
                file: "f.js",
                size: 0,
                format: "esm",
                entry: "default",
                sha256: "s2",
              },
            },
          },
        },
      },
      async (binding) => {
        if (binding.bundle === "b1") {
          return "export default async (p, ctx) => { await ctx.actions.dispatch({ event: 'event_x' }, { data: 1 }); return { dispatched: true }; }";
        }
        return "export default async (p) => ({ received: true })";
      },
      persistence,
      resolver,
    );

    const result = await runtime.handleEvent({
      type: "onMessage",
      payload: {},
      threadId: "th1",
    });
    expect(result).toEqual({ dispatched: true });

    const events = adapters.events.getEvents();
    expect(events.some((e) => e.type === "listener.queued")).toBe(true);
  });
});
