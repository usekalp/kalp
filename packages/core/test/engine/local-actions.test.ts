import { describe, it, expect } from "vitest";
import { createLocalActions } from "../../src/engine/local-actions";
import { createFakeAdapters } from "../fixtures/fake-adapters";
import { ReplayLog } from "../../src/state/replay-log";
import { createRootFrame } from "../../src/execution/frame";
import type { PersistenceAdapter } from "../../src/adapters/interfaces";

describe("createLocalActions", () => {
  function createContext() {
    const adapters = createFakeAdapters();
    const persistence: PersistenceAdapter = { state: adapters.state, events: adapters.events, idempotency: adapters.state, threads: adapters.state };
    const log = new ReplayLog();
    const frame = createRootFrame(
      { traceId: "t1", threadId: "th1", untrackedIOCount: 0, untrackedIOByType: { network: 0, timer: 0, fs: 0, unknown: 0 }, hasUntrustedPlugins: false },
      "exec-1", 0,
    );
    const ir = {
      schemaVersion: 3,
      requirements: {},
      agent: { name: "test" },
      nodes: {
        n_listener: {
          id: "n_listener",
          stableName: "listener.event_x",
          kind: "listener",
          trigger: { type: "listener", event: "event_x" },
          listener: { event: "event_x" },
        },
      },
    } as any;
    const bundleManifest = { schemaVersion: 3, targets: { default: { abiVersion: 1, nodes: {} } } } as any;
    return { adapters, persistence, log, frame, ir, bundleManifest };
  }

  it("should dispatch and queue event", async () => {
    const ctx = createContext();
    const actions = createLocalActions(
      ctx.frame, ctx.ir, ctx.persistence, ctx.log,
      {} as any, {}, ctx.bundleManifest, async () => "", {},
      [],
    );
    const result = await actions.dispatch({ event: "event_x" }, { data: 1 });
    expect(result).toEqual({ eventId: expect.any(String) });

    const events = ctx.adapters.events.getEvents();
    expect(events.some((e: any) => e.type === "listener.queued")).toBe(true);
  });

  it("should throw when listener not found on dispatch", async () => {
    const ctx = createContext();
    const actions = createLocalActions(
      ctx.frame, ctx.ir, ctx.persistence, ctx.log,
      {} as any, {}, ctx.bundleManifest, async () => "", {},
      [],
    );
    await expect(actions.dispatch({ event: "unknown" }, {})).rejects.toThrow("No local listener found");
  });

  it("should throw when listener not found on call", async () => {
    const ctx = createContext();
    const actions = createLocalActions(
      ctx.frame, ctx.ir, ctx.persistence, ctx.log,
      {} as any, {}, ctx.bundleManifest, async () => "", {},
      [],
    );
    await expect(actions.call({ event: "unknown" }, {})).rejects.toThrow("No local listener found");
  });
});
