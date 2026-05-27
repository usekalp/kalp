import { describe, it, expect } from "vitest";
import { resolveNodeId, resolveListenerNodeId, isDispatchEnvelope } from "../../src/engine/event-router";
import type { IRGraph } from "@kalphq/sdk";

function createTestIR(): IRGraph {
  return {
    schemaVersion: 3,
    agent: { name: "test" },
    nodes: {
      n_msg: { id: "n_msg", stableName: "hook.message", kind: "message", trigger: { type: "message" } },
      n_init: { id: "n_init", stableName: "hook.init", kind: "init", trigger: { type: "lifecycle", event: "init" } },
      n_tick: { id: "n_tick", stableName: "hook.tick", kind: "tick", trigger: { type: "lifecycle", event: "tick" } },
      n_listener: { id: "n_listener", stableName: "listener.event_x", kind: "listener", trigger: { type: "listener", event: "event_x" }, listener: { event: "event_x" } },
      n_route: { id: "n_route", stableName: "route.get_foo", kind: "route", trigger: { type: "http", method: "GET", path: "/foo" }, http: { method: "GET" as const, path: "/foo" } },
      n_contract: { id: "n_contract", stableName: "contract.svc", kind: "contract", trigger: { type: "rpc", contractName: "svc" } },
      n_cron: { id: "n_cron", stableName: "cron.hourly", kind: "cron", trigger: { type: "schedule", scheduleId: "hourly" } },
      n_direct: { id: "n_direct", stableName: "some.handler", kind: "tool" },
    },
  };
}

describe("resolveNodeId", () => {
  const ir = createTestIR();

  it("should resolve onMessage", () => {
    expect(resolveNodeId("onMessage", ir)).toBe("n_msg");
  });

  it("should resolve onInit", () => {
    expect(resolveNodeId("onInit", ir)).toBe("n_init");
  });

  it("should resolve onTick", () => {
    expect(resolveNodeId("onTick", ir)).toBe("n_tick");
  });

  it("should resolve contract events", () => {
    expect(resolveNodeId("contract:svc", ir)).toBe("n_contract");
  });

  it("should resolve listener events", () => {
    expect(resolveNodeId("listener:event_x", ir)).toBe("n_listener");
  });

  it("should resolve route events", () => {
    expect(resolveNodeId("route:GET:/foo", ir)).toBe("n_route");
  });

  it("should resolve schedule events", () => {
    expect(resolveNodeId("schedule:hourly", ir)).toBe("n_cron");
  });

  it("should resolve direct node IDs", () => {
    expect(resolveNodeId("n_direct", ir)).toBe("n_direct");
  });

  it("should return null for unknown event type", () => {
    expect(resolveNodeId("unknown", ir)).toBeNull();
  });
});

describe("resolveListenerNodeId", () => {
  const ir = createTestIR();

  it("should resolve by __runtimeId", () => {
    expect(resolveListenerNodeId({ __runtimeId: "listener:event_x" }, ir)).toBe("n_listener");
  });

  it("should resolve by event name", () => {
    expect(resolveListenerNodeId({ event: "event_x" }, ir)).toBe("n_listener");
  });

  it("should return null for unknown listener", () => {
    expect(resolveListenerNodeId({ event: "nonexistent" }, ir)).toBeNull();
  });

  it("should return null for null/undefined", () => {
    expect(resolveListenerNodeId(null, ir)).toBeNull();
    expect(resolveListenerNodeId(undefined, ir)).toBeNull();
  });
});

describe("isDispatchEnvelope", () => {
  it("should detect valid dispatch envelope", () => {
    expect(isDispatchEnvelope({ eventName: "e", traceId: "t", parentExecutionId: "p" })).toBe(true);
  });

  it("should reject invalid payloads", () => {
    expect(isDispatchEnvelope(null)).toBe(false);
    expect(isDispatchEnvelope("string")).toBe(false);
    expect(isDispatchEnvelope({})).toBe(false);
    expect(isDispatchEnvelope({ eventName: "e" })).toBe(false);
  });
});
