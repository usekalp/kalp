import { describe, it, expect } from "vitest";
import { createRootFrame } from "../../src/execution/frame";

describe("createRootFrame", () => {
  it("should create frame with execution context", () => {
    const frame = createRootFrame(
      { traceId: "t1", threadId: "th1", untrackedIOCount: 0, untrackedIOByType: { network: 0, timer: 0, fs: 0, unknown: 0 }, hasUntrustedPlugins: false },
      "exec-1",
      0,
    );
    expect(frame.executionId).toBe("exec-1");
    expect(frame.ctx.traceId).toBe("t1");
    expect(frame.ctx.threadId).toBe("th1");
    expect(frame.seqCounter).toBe(0);
  });

  it("should start seqCounter at given startingSeq", () => {
    const frame = createRootFrame(
      { traceId: "t1", threadId: "th1", untrackedIOCount: 0, untrackedIOByType: { network: 0, timer: 0, fs: 0, unknown: 0 }, hasUntrustedPlugins: false },
      "exec-1",
      42,
    );
    expect(frame.seqCounter).toBe(42);
  });

  it("should increment seqCounter", () => {
    const frame = createRootFrame(
      { traceId: "t1", threadId: "th1", untrackedIOCount: 0, untrackedIOByType: { network: 0, timer: 0, fs: 0, unknown: 0 }, hasUntrustedPlugins: false },
      "exec-1",
      0,
    );
    const val = frame.seqCounter++;
    expect(val).toBe(0);
    expect(frame.seqCounter).toBe(1);
  });
});
