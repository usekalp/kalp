import { describe, it, expect } from "vitest";
import { createRuntimeContext } from "../../src/effects/primitives/runtime";

describe("createRuntimeContext", () => {
  it("should return the provided run metadata", () => {
    const rt = createRuntimeContext({
      runId: "run-1",
      executionId: "exec-1",
      traceId: "trace-1",
      threadId: "thread-1",
      environment: "dev",
      startedAt: 1000,
    });
    expect(rt.runId).toBe("run-1");
    expect(rt.executionId).toBe("exec-1");
    expect(rt.traceId).toBe("trace-1");
    expect(rt.threadId).toBe("thread-1");
    expect(rt.environment).toBe("dev");
    expect(rt.startedAt).toBe(1000);
  });

  it("should allow optional generation and lastWakeReason", () => {
    const rt = createRuntimeContext({
      runId: "run-2",
      executionId: "exec-2",
      traceId: "trace-2",
      threadId: "thread-2",
      environment: "production",
      generation: 3,
      lastWakeReason: { type: "timeout" },
      startedAt: 2000,
    });
    expect(rt.generation).toBe(3);
    expect(rt.lastWakeReason).toEqual({ type: "timeout" });
  });
});
