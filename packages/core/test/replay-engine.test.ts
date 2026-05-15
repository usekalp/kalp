/**
 * Tests for replay-engine drift protection.
 *
 * These tests verify that:
 * 1. Replay engine detects divergence between historical and current actions
 * 2. Drift detection returns success: false with divergence details
 * 3. Sequence key drift is properly identified
 *
 * @module
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  validateReplay,
  detectSequenceKeyDrift,
  replayAndValidate,
  type ReplayResult,
} from "../src/engine/replay-engine";
import { ReplayLog } from "../src/state/replay-log";
import type { PersistedEffect } from "../src/state/replay-log";

describe("replay-engine", () => {
  let log: ReplayLog;

  beforeEach(() => {
    log = new ReplayLog();
  });

  describe("drift detection", () => {
    it("should return success: true when replay matches history", async () => {
      const executionId = "test-exec-1";

      // Populate log with historical events
      const historicalEvents: PersistedEffect[] = [
        {
          seq: 1,
          type: "intent.fetch",
          executionId,
          traceId: "trace-1",
          threadId: "thread-1",
          timestamp: Date.now(),
          payload: { url: "https://api.example.com" },
          result: { status: 200 },
        },
        {
          seq: 2,
          type: "intent.emit",
          executionId,
          traceId: "trace-1",
          threadId: "thread-1",
          timestamp: Date.now(),
          payload: { event: "test" },
        },
      ];

      // Load events into buffer
      for (const event of historicalEvents) {
        log.append(event);
      }

      // Create matching new intents (same types)
      const newIntents: PersistedEffect[] = [
        {
          seq: 1,
          type: "intent.fetch",
          executionId,
          traceId: "trace-1",
          threadId: "thread-1",
          timestamp: Date.now(),
          payload: { url: "https://api.example.com" },
          result: { status: 200 },
        },
        {
          seq: 2,
          type: "intent.emit",
          executionId,
          traceId: "trace-1",
          threadId: "thread-1",
          timestamp: Date.now(),
          payload: { event: "test" },
        },
      ];

      const result = validateReplay(log, executionId, newIntents);

      expect(result.success).toBe(true);
      expect(result.divergenceAt).toBeUndefined();
    });

    it("should detect divergence when action types differ", async () => {
      const executionId = "drift-exec-1";

      // Historical log has "intent.action_fetch"
      const historicalEvents: PersistedEffect[] = [
        {
          seq: 1,
          type: "intent.action_fetch",
          executionId,
          traceId: "trace-1",
          threadId: "thread-1",
          timestamp: Date.now(),
          payload: { url: "https://api.example.com" },
          result: { status: 200 },
        },
      ];

      for (const event of historicalEvents) {
        log.append(event);
      }

      // Current execution emits "intent.action_run" instead
      const newIntents: PersistedEffect[] = [
        {
          seq: 1,
          type: "intent.action_run",
          executionId,
          traceId: "trace-1",
          threadId: "thread-1",
          timestamp: Date.now(),
          payload: { handler: "some-handler" },
        },
      ];

      const result: ReplayResult = validateReplay(log, executionId, newIntents);

      // Verify divergence detected
      expect(result.success).toBe(false);
      expect(result.divergenceAt).toBe(1);
      expect(result.expected?.type).toBe("intent.action_fetch");
      expect(result.actual?.type).toBe("intent.action_run");
    });

    it("should detect sequence count mismatch", async () => {
      const executionId = "count-exec-1";

      // Historical log has 2 events
      const historicalEvents: PersistedEffect[] = [
        {
          seq: 1,
          type: "intent.fetch",
          executionId,
          traceId: "trace-1",
          threadId: "thread-1",
          timestamp: Date.now(),
          payload: {},
        },
        {
          seq: 2,
          type: "intent.fetch",
          executionId,
          traceId: "trace-1",
          threadId: "thread-1",
          timestamp: Date.now(),
          payload: {},
        },
      ];

      for (const event of historicalEvents) {
        log.append(event);
      }

      // Current execution only emits 1 event
      const newIntents: PersistedEffect[] = [
        {
          seq: 1,
          type: "intent.fetch",
          executionId,
          traceId: "trace-1",
          threadId: "thread-1",
          timestamp: Date.now(),
          payload: {},
        },
      ];

      const result = validateReplay(log, executionId, newIntents);

      expect(result.success).toBe(false);
      expect(result.driftDetected).toBe(false); // Not drift, just incomplete
    });

    it("should detect extra events as drift", async () => {
      const executionId = "extra-exec-1";

      // Historical log has 1 event
      const historicalEvents: PersistedEffect[] = [
        {
          seq: 1,
          type: "intent.fetch",
          executionId,
          traceId: "trace-1",
          threadId: "thread-1",
          timestamp: Date.now(),
          payload: {},
        },
      ];

      for (const event of historicalEvents) {
        log.append(event);
      }

      // Current execution emits 2 events (extra)
      const newIntents: PersistedEffect[] = [
        {
          seq: 1,
          type: "intent.fetch",
          executionId,
          traceId: "trace-1",
          threadId: "thread-1",
          timestamp: Date.now(),
          payload: {},
        },
        {
          seq: 2,
          type: "intent.fetch",
          executionId,
          traceId: "trace-1",
          threadId: "thread-1",
          timestamp: Date.now(),
          payload: {},
        },
      ];

      const result = validateReplay(log, executionId, newIntents);

      expect(result.success).toBe(false);
      expect(result.driftDetected).toBe(true); // Extra events = drift
    });

    it("should return success for fresh execution with no history", async () => {
      const executionId = "fresh-exec-1";

      // No historical events in log

      const newIntents: PersistedEffect[] = [
        {
          seq: 1,
          type: "intent.fetch",
          executionId,
          traceId: "trace-1",
          threadId: "thread-1",
          timestamp: Date.now(),
          payload: {},
        },
      ];

      const result = validateReplay(log, executionId, newIntents);

      expect(result.success).toBe(true);
    });
  });

  describe("sequence key drift detection", () => {
    it("should detect handler hash mismatch", () => {
      const suspendedHash = "abc123";
      const currentHash = "def456";

      const isDrift = detectSequenceKeyDrift(suspendedHash, currentHash);

      expect(isDrift).toBe(true);
    });

    it("should return false when hashes match", () => {
      const hash = "same-hash-123";

      const isDrift = detectSequenceKeyDrift(hash, hash);

      expect(isDrift).toBe(false);
    });
  });

  describe("replay and validate integration", () => {
    it("should validate after replay function completes", async () => {
      const executionId = "integration-exec-1";

      // Setup historical log
      const historicalEvents: PersistedEffect[] = [
        {
          seq: 1,
          type: "intent.emit",
          executionId,
          traceId: "trace-1",
          threadId: "thread-1",
          timestamp: Date.now(),
          payload: { event: "test" },
        },
      ];

      for (const event of historicalEvents) {
        log.append(event);
      }

      // Replay function that produces matching intents
      const replayFn = async (): Promise<PersistedEffect[]> => {
        return [
          {
            seq: 1,
            type: "intent.emit",
            executionId,
            traceId: "trace-1",
            threadId: "thread-1",
            timestamp: Date.now(),
            payload: { event: "test" },
          },
        ];
      };

      const result = await replayAndValidate(log, executionId, replayFn);

      expect(result.success).toBe(true);
    });

    it("should detect divergence in async replay", async () => {
      const executionId = "async-exec-1";

      // Setup historical log with fetch
      const historicalEvents: PersistedEffect[] = [
        {
          seq: 1,
          type: "intent.action_fetch",
          executionId,
          traceId: "trace-1",
          threadId: "thread-1",
          timestamp: Date.now(),
          payload: {},
        },
      ];

      for (const event of historicalEvents) {
        log.append(event);
      }

      // Replay function that produces different action type
      const replayFn = async (): Promise<PersistedEffect[]> => {
        return [
          {
            seq: 1,
            type: "intent.action_run",
            executionId,
            traceId: "trace-1",
            threadId: "thread-1",
            timestamp: Date.now(),
            payload: {},
          },
        ];
      };

      const result = await replayAndValidate(log, executionId, replayFn);

      expect(result.success).toBe(false);
      expect(result.divergenceAt).toBe(1);
    });
  });

  describe("V1 payload comparison behavior", () => {
    it("should NOT compare full payloads (V1 behavior)", async () => {
      const executionId = "v1-exec-1";

      // Historical event with specific payload
      const historicalEvents: PersistedEffect[] = [
        {
          seq: 1,
          type: "intent.fetch",
          executionId,
          traceId: "trace-1",
          threadId: "thread-1",
          timestamp: Date.now(),
          payload: { a: 1, b: 2, c: 3 }, // Different key order
          result: { data: "result" },
        },
      ];

      for (const event of historicalEvents) {
        log.append(event);
      }

      // New intent with same type but different payload structure
      // V1 should NOT flag this as drift (only type matters)
      const newIntents: PersistedEffect[] = [
        {
          seq: 1,
          type: "intent.fetch",
          executionId,
          traceId: "trace-1",
          threadId: "thread-1",
          timestamp: Date.now(),
          payload: { c: 3, b: 2, a: 1 }, // Different key order
          result: { data: "different-result" }, // Different result
        },
      ];

      const result = validateReplay(log, executionId, newIntents);

      // V1: Should pass because type matches, payload not compared
      expect(result.success).toBe(true);
    });
  });
});
