import { describe, it, expect, vi } from "vitest";
import { ReplayLog, serializeError } from "../../src/state/replay-log";
import type { EventStore } from "../../src/adapters/interfaces";

function mockEventStore(overrides?: Partial<EventStore>): EventStore {
  return {
    loadAll: vi.fn(),
    loadByThread: vi.fn(),
    loadByTrace: vi.fn(),
    append: vi.fn(),
    ...overrides,
  } as EventStore;
}

describe("ReplayLog", () => {
  it("loadFromSQLite filters by threadId when provided", async () => {
    const store = mockEventStore({
      loadByThread: vi.fn().mockResolvedValue([]),
    });
    const log = new ReplayLog();
    await log.loadFromSQLite(store, { threadId: "t1" });
    expect(store.loadByThread).toHaveBeenCalledWith("t1");
  });

  it("loadFromSQLite filters by traceId when threadId is not provided", async () => {
    const store = mockEventStore({
      loadByTrace: vi.fn().mockResolvedValue([]),
    });
    const log = new ReplayLog();
    await log.loadFromSQLite(store, { traceId: "tr1" });
    expect(store.loadByTrace).toHaveBeenCalledWith("tr1");
  });

  it("loadFromSQLite loads all events when no filters provided", async () => {
    const store = mockEventStore({
      loadAll: vi.fn().mockResolvedValue([]),
    });
    const log = new ReplayLog();
    await log.loadFromSQLite(store);
    expect(store.loadAll).toHaveBeenCalled();
  });

  it("loadFromSQLite filters out events without seq", async () => {
    const store = mockEventStore({
      loadAll: vi.fn().mockResolvedValue([
        { executionId: "e1", seq: undefined, type: "noop" },
        { executionId: "e1", seq: 0, type: "effect1" },
      ]),
    });
    const log = new ReplayLog();
    await log.loadFromSQLite(store);
    expect(log.get("e1", 0)).toBeDefined();
  });

  it("loadFromSQLite groups events by executionId", async () => {
    const store = mockEventStore({
      loadAll: vi.fn().mockResolvedValue([
        { executionId: "e1", seq: 0, type: "a", traceId: "t", threadId: "th", timestamp: 1, payload: {} },
        { executionId: "e2", seq: 0, type: "b", traceId: "t", threadId: "th", timestamp: 2, payload: {} },
      ]),
    });
    const log = new ReplayLog();
    await log.loadFromSQLite(store);
    expect(log.get("e1", 0)).toBeDefined();
    expect(log.get("e2", 0)).toBeDefined();
  });

  it("get returns undefined for missing executionId", () => {
    const log = new ReplayLog();
    expect(log.get("nonexistent", 0)).toBeUndefined();
  });

  it("get returns undefined for sparse seq gap", () => {
    const log = new ReplayLog();
    log.append({
      seq: 0, type: "effect0", executionId: "e1", traceId: "t", threadId: "th", timestamp: 1, payload: {},
    });
    log.append({
      seq: 2, type: "effect2", executionId: "e1", traceId: "t", threadId: "th", timestamp: 2, payload: {},
    });
    expect(log.get("e1", 1)).toBeUndefined();
  });

  it("get returns effect when it exists", () => {
    const log = new ReplayLog();
    const effect = {
      seq: 0, type: "test", executionId: "e1", traceId: "t", threadId: "th", timestamp: 1, payload: {},
    };
    log.append(effect);
    expect(log.get("e1", 0)).toEqual(effect);
  });

  it("append creates new array for new executionId", () => {
    const log = new ReplayLog();
    log.append({
      seq: 0, type: "test", executionId: "new-exec", traceId: "t", threadId: "th", timestamp: 1, payload: {} },
    );
    expect(log.get("new-exec", 0)).toBeDefined();
  });

  it("append adds to existing array for known executionId", () => {
    const log = new ReplayLog();
    log.append({
      seq: 0, type: "first", executionId: "e1", traceId: "t", threadId: "th", timestamp: 1, payload: {},
    });
    log.append({
      seq: 1, type: "second", executionId: "e1", traceId: "t", threadId: "th", timestamp: 2, payload: {},
    });
    expect(log.get("e1", 0)).toBeDefined();
    expect(log.get("e1", 1)).toBeDefined();
  });

  it("getAll returns effects for existing execution", () => {
    const log = new ReplayLog();
    log.append({
      seq: 0, type: "a", executionId: "e1", traceId: "t", threadId: "th", timestamp: 1, payload: {},
    });
    log.append({
      seq: 1, type: "b", executionId: "e1", traceId: "t", threadId: "th", timestamp: 2, payload: {},
    });
    const effects = log.getAll("e1");
    expect(effects).toHaveLength(2);
  });

  it("getAll returns undefined for non-existing execution", () => {
    const log = new ReplayLog();
    expect(log.getAll("nowhere")).toBeUndefined();
  });

  it("clear empties all cached effects", () => {
    const log = new ReplayLog();
    log.append({
      seq: 0, type: "a", executionId: "e1", traceId: "t", threadId: "th", timestamp: 1, payload: {},
    });
    expect(log.get("e1", 0)).toBeDefined();
    log.clear();
    expect(log.get("e1", 0)).toBeUndefined();
  });
});

describe("serializeError", () => {
  it("returns message, name, stack for Error instance", () => {
    const err = new Error("boom");
    const result = serializeError(err);
    expect(result).toEqual({
      message: "boom",
      name: "Error",
      stack: err.stack,
    });
  });

  it("returns String(error) and UnknownError for non-Error input", () => {
    const result = serializeError("crash");
    expect(result).toEqual({
      message: "crash",
      name: "UnknownError",
    });
  });

  it("returns UnknownError for null input", () => {
    const result = serializeError(null);
    expect(result).toEqual({
      message: "null",
      name: "UnknownError",
    });
  });
});