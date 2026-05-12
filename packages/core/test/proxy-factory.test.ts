/**
 * Tests for proxy-factory determinism and caching.
 *
 * These tests verify that:
 * 1. Actions emit events on first execution
 * 2. Cached results are returned on replay without re-execution
 * 3. Sequence keys are assigned synchronously before async resolution
 *
 * @module
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createActionProxy } from "../src/engine/proxy-factory";
import { EventLogBuffer } from "../src/engine/event-log-buffer";
import { createFakeAdapters } from "./fixtures/fake-adapters";
import type { ExecutionContext } from "../src/engine/types";
import type { IRGraph } from "@kalphq/sdk";

// Mock IR manifest for testing
const mockIR: IRGraph = {
  version: 1,
  entries: {},
  bundles: {},
  metadata: {
    name: "test-agent",
    description: "Test agent",
    systemPrompt: "You are a test agent",
  },
  schedules: {},
};

// Create a minimal execution context
function createMockExecContext(executionId = "test-exec-1"): ExecutionContext {
  return {
    executionId,
    traceId: "test-trace-1",
    threadId: "test-thread-1",
    seqCounter: 0,
    untrackedIOCount: 0,
    untrackedIOByType: { network: 0, timer: 0, fs: 0, unknown: 0 },
    hasUntrustedPlugins: false,
  };
}

describe("proxy-factory", () => {
  let adapters: ReturnType<typeof createFakeAdapters>;
  let log: EventLogBuffer;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    adapters = createFakeAdapters();
    log = new EventLogBuffer();

    // Mock global fetch
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("determinism and caching", () => {
    it("should emit event and execute fetch on first call", async () => {
      const execCtx = createMockExecContext();

      // Mock fetch response
      fetchMock.mockResolvedValueOnce({
        status: 200,
        statusText: "OK",
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ data: "response" }),
        text: async () => JSON.stringify({ data: "response" }),
      } as Response);

      const persistEvent = async (event: unknown) => {
        await adapters.events.append(event as never);
      };

      const actions = createActionProxy(
        log,
        adapters.scheduler,
        execCtx,
        async () => "result",
        persistEvent,
        mockIR,
      );

      // Execute fetch
      const result = await actions.fetch("https://api.example.com/data", {
        method: "GET",
      });

      // Verify result
      expect(result.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.example.com/data",
        expect.objectContaining({ method: "GET" }),
      );

      // Verify event was emitted
      const events = adapters.events.getEvents();
      expect(events.length).toBeGreaterThan(0);

      // Check that seq was assigned
      const lastEvent = events[events.length - 1];
      expect(lastEvent).toMatchObject({
        type: "intent.fetch",
        executionId: execCtx.executionId,
      });
    });

    it("should return cached result on replay without re-execution", async () => {
      const executionId = "test-replay-1";
      const execCtx = createMockExecContext(executionId);

      // Directly populate the log buffer with a cached event
      // Note: result must have body, status, headers (the format fetch stores)
      log.append({
        seq: 1,
        type: "intent.fetch",
        executionId,
        traceId: execCtx.traceId,
        threadId: execCtx.threadId,
        timestamp: Date.now(),
        payload: { url: "https://api.example.com/data", method: "GET" },
        result: {
          body: JSON.stringify({ data: "cached-response" }),
          status: 200,
          headers: { "content-type": "application/json" },
        },
      });

      const persistEvent = async () => {
        /* no-op */
      };

      const actions = createActionProxy(
        log,
        adapters.scheduler,
        execCtx,
        async () => "result",
        persistEvent,
        mockIR,
      );

      // Call fetch - should return cached Response immediately
      const result = await actions.fetch("https://api.example.com/data", {
        method: "GET",
      });

      // Verify cached Response was returned
      expect(result).toBeInstanceOf(Response);
      expect(result.status).toBe(200);
      const body = await result.text();
      expect(JSON.parse(body)).toEqual({ data: "cached-response" });

      // Verify fetch was NOT called (cache hit)
      expect(fetchMock).not.toHaveBeenCalled();

      // Verify no new events were emitted (cache hit)
      const events = adapters.events.getEvents();
      expect(events.length).toBe(0);
    });

    it("should assign synchronous sequence keys with Promise.all", async () => {
      const execCtx = createMockExecContext();

      // Track sequence numbers at the moment of call
      const capturedSeqs: number[] = [];

      // Mock fetch to delay resolution
      fetchMock
        .mockImplementationOnce(async () => {
          await new Promise((r) => setTimeout(r, 50));
          return {
            status: 200,
            statusText: "OK",
            headers: new Headers(),
            json: async () => ({ data: "response1" }),
            text: async () => "response1",
          } as Response;
        })
        .mockImplementationOnce(async () => {
          await new Promise((r) => setTimeout(r, 10));
          return {
            status: 200,
            statusText: "OK",
            headers: new Headers(),
            json: async () => ({ data: "response2" }),
            text: async () => "response2",
          } as Response;
        });

      const persistEvent = async (event: { seq?: number }) => {
        if (event.seq) {
          capturedSeqs.push(event.seq);
        }
        await adapters.events.append(event as never);
      };

      const actions = createActionProxy(
        log,
        adapters.scheduler,
        execCtx,
        async () => "result",
        persistEvent,
        mockIR,
      );

      // Create two fetch promises - second resolves faster but seq should still be 1, 2
      const fetch1 = actions.fetch("https://api1.example.com", {
        method: "GET",
      });
      const fetch2 = actions.fetch("https://api2.example.com", {
        method: "GET",
      });

      // Execute both simultaneously
      await Promise.all([fetch1, fetch2]);

      // Verify sequence numbers were assigned synchronously (1 and 2)
      expect(capturedSeqs).toHaveLength(2);
      expect(capturedSeqs).toContain(1);
      expect(capturedSeqs).toContain(2);

      // Verify they are consecutive
      expect(Math.abs(capturedSeqs[0] - capturedSeqs[1])).toBe(1);
    });

    it("should maintain sequence order across multiple action types", async () => {
      const execCtx = createMockExecContext();
      const capturedSeqs: number[] = [];

      // Mock fetch
      fetchMock.mockResolvedValue({
        status: 200,
        statusText: "OK",
        headers: new Headers(),
        json: async () => ({ data: "response" }),
        text: async () => "response",
      } as Response);

      const persistEvent = async (event: { seq?: number }) => {
        if (event.seq) {
          capturedSeqs.push(event.seq);
        }
        await adapters.events.append(event as never);
      };

      const actions = createActionProxy(
        log,
        adapters.scheduler,
        execCtx,
        async () => "result",
        persistEvent,
        mockIR,
      );

      // Execute different action types in sequence
      await actions.fetch("https://api.example.com", { method: "GET" });
      await actions.emit("test-event", { data: "value" });

      // Verify sequence numbers are consecutive (1, 2, 3, etc.)
      expect(capturedSeqs.length).toBeGreaterThanOrEqual(2);

      // Check they are in ascending order
      for (let i = 1; i < capturedSeqs.length; i++) {
        expect(capturedSeqs[i]).toBeGreaterThan(capturedSeqs[i - 1]);
      }
    });
  });

  describe("action.fetch", () => {
    it("should validate URL and method", async () => {
      const execCtx = createMockExecContext();

      const persistEvent = async () => {
        /* no-op */
      };

      const actions = createActionProxy(
        log,
        adapters.scheduler,
        execCtx,
        async () => "result",
        persistEvent,
        mockIR,
      );

      // Should throw on invalid URL
      await expect(
        actions.fetch("not-a-valid-url", { method: "GET" }),
      ).rejects.toThrow();
    });

    it("should include body in payload when provided", async () => {
      const execCtx = createMockExecContext();
      const capturedEvents: Array<{ payload?: unknown }> = [];

      // Mock fetch
      fetchMock.mockResolvedValue({
        status: 200,
        statusText: "OK",
        headers: new Headers(),
        json: async () => ({ success: true }),
        text: async () => '{"success":true}',
      } as Response);

      const persistEvent = async (event: { payload?: unknown }) => {
        capturedEvents.push(event);
        await adapters.events.append(event as never);
      };

      const actions = createActionProxy(
        log,
        adapters.scheduler,
        execCtx,
        async () => "result",
        persistEvent,
        mockIR,
      );

      await actions.fetch("https://api.example.com/data", {
        method: "POST",
        body: JSON.stringify({ key: "value" }),
      });

      // Verify body was included in payload
      const fetchEvent = capturedEvents.find(
        (e) => (e.payload as { method?: string })?.method === "POST",
      );
      expect(fetchEvent).toBeDefined();
      const body = (fetchEvent!.payload as { body?: string })?.body;
      expect(body).toBeDefined();
      expect(typeof body).toBe("string");
      expect(JSON.parse(body!)).toEqual({ key: "value" });
    });
  });
});
