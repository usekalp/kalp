import { describe, it, expect } from "vitest";
import { loadAgentState, persistValidatedState } from "../../src/engine/state-manager";
import { createFakeAdapters } from "../fixtures/fake-adapters";
import { createRootFrame } from "../../src/execution/frame";
import type { PersistenceAdapter } from "../../src/adapters/interfaces";

function createPersistence(): PersistenceAdapter {
  const adapters = createFakeAdapters();
  return { state: adapters.state, events: adapters.events, idempotency: adapters.state, threads: adapters.state };
}

describe("loadAgentState", () => {
  it("should load stored state", async () => {
    const persistence = createPersistence();
    await persistence.state.set("__kalp_state__", { count: 1 });
    const state = await loadAgentState(persistence);
    expect(state).toEqual({ count: 1 });
  });

  it("should return empty object when no state stored", async () => {
    const persistence = createPersistence();
    const state = await loadAgentState(persistence);
    expect(state).toEqual({});
  });

  it("should return empty object for invalid stored value", async () => {
    const persistence = createPersistence();
    await persistence.state.set("__kalp_state__", "not-an-object");
    const state = await loadAgentState(persistence);
    expect(state).toEqual({});
  });
});

describe("persistValidatedState", () => {
  it("should persist valid state", async () => {
    const persistence = createPersistence();
    const frame = createRootFrame(
      { traceId: "t1", threadId: "th1", untrackedIOCount: 0, untrackedIOByType: { network: 0, timer: 0, fs: 0, unknown: 0 }, hasUntrustedPlugins: false },
      "exec-1",
      0,
    );
    await persistValidatedState(undefined, { count: 1 }, frame, persistence);
    const stored = await persistence.state.get("__kalp_state__");
    expect(stored).toEqual({ count: 1 });
  });

  it("should throw on invalid state", async () => {
    const persistence = createPersistence();
    const frame = createRootFrame(
      { traceId: "t1", threadId: "th1", untrackedIOCount: 0, untrackedIOByType: { network: 0, timer: 0, fs: 0, unknown: 0 }, hasUntrustedPlugins: false },
      "exec-1",
      0,
    );
    const schema = { type: "object", required: ["name"], properties: { name: { type: "string" } } };
    await expect(persistValidatedState(schema, {}, frame, persistence)).rejects.toThrow("State validation failed");
  });
});
