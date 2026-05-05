import { describe, expect, it } from "vitest";
import {
  asAgentId,
  asUserId,
  asThreadId,
  asExecutionId,
  asTraceId,
} from "../src";

describe("Branded Types", () => {
  describe("asAgentId", () => {
    it("keeps original value", () => {
      expect(asAgentId("a-1")).toBe("a-1");
      expect(asAgentId("my-agent")).toBe("my-agent");
    });
  });

  describe("asUserId", () => {
    it("keeps original value", () => {
      expect(asUserId("u-1")).toBe("u-1");
      expect(asUserId("user@example.com")).toBe("user@example.com");
    });
  });

  describe("asThreadId", () => {
    it("keeps original value", () => {
      expect(asThreadId("t-1")).toBe("t-1");
    });
  });

  describe("asExecutionId", () => {
    it("keeps original value", () => {
      expect(asExecutionId("e-1")).toBe("e-1");
    });
  });

  describe("asTraceId", () => {
    it("keeps original value", () => {
      expect(asTraceId("tr-1")).toBe("tr-1");
    });
  });
});
