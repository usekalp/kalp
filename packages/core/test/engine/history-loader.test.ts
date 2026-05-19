import { describe, it, expect } from "vitest";
import { loadHistory } from "../../src/engine/history-loader";
import { createFakeAdapters } from "../fixtures/fake-adapters";
import type { PersistenceAdapter } from "../../src/adapters/interfaces";

describe("loadHistory", () => {
  it("should return empty array for empty threadId", async () => {
    const adapters = createFakeAdapters();
    const persistence: PersistenceAdapter = { state: adapters.state, events: adapters.events, idempotency: adapters.state, threads: adapters.state };
    const result = await loadHistory("", persistence);
    expect(result).toEqual([]);
  });

  it("should return filtered events for a thread", async () => {
    const adapters = createFakeAdapters();
    const persistence: PersistenceAdapter = { state: adapters.state, events: adapters.events, idempotency: adapters.state, threads: adapters.state };

    await adapters.events.append({
      type: "node.completed", nodeId: "n1", result: "ok",
      executionId: "e1", traceId: "t1", threadId: "th1", timestamp: 100,
    } as any);
    await adapters.events.append({
      type: "node.started", nodeId: "n1",
      executionId: "e1", traceId: "t1", threadId: "th1", timestamp: 50,
    } as any);

    const result = await loadHistory("th1", persistence);
    expect(result).toHaveLength(1);
    expect(result[0]!.role).toBe("assistant");
    expect(result[0]!.content).toContain("ok");
  });

  it("should return empty array on error", async () => {
    const persistence = {
      events: { loadByThread: async () => { throw new Error("db error"); } },
    } as any;
    const result = await loadHistory("th1", persistence);
    expect(result).toEqual([]);
  });
});
