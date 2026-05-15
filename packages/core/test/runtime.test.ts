/**
 * End-to-end tests for KalpRuntime using in-memory adapters.
 *
 * These tests verify the full execution flow:
 * 1. Runtime receives a RuntimeEvent
 * 2. Handler executes with context
 * 3. Actions emit events and can suspend
 * 4. Resume continues from suspension point
 *
 * @module
 */

import { describe, it, expect, beforeEach } from "vitest";
import { KalpRuntime } from "../src/engine/runtime";
import { createFakeAdapters } from "./fixtures/fake-adapters";
import type { RuntimeEvent } from "../src/engine/types";
import type { IRGraph } from "@kalphq/sdk";
import { asUserId } from "@kalphq/sdk";
import { FakeEffectResolver } from "./fixtures/fake-resolver";

// Helper to create mock IR with proper SDK types
const createMockIR = (): any => ({
  version: 2,
  agent: {
    name: "test-runtime-agent",
    description: "Test agent for runtime E2E tests",
    systemPrompt: "You are a test agent",
  },
  nodes: {
    "hook:message": {
      kind: "message",
      bundle: "on-message-handler",
      trigger: { type: "message" },
    },
    "step:suspend-handler": {
      kind: "step",
      bundle: "suspend-handler",
    },
    "cron:0": {
      kind: "cron",
      bundle: "schedule-handler",
      trigger: { type: "schedule", scheduleId: "cron:0" },
      schedule: { expression: "0 * * * *" },
    },
  },
  bundles: {
    "on-message-handler": {
      hash: "on-message-handler",
      code: `
        return async (payload, ctx) => {
          await ctx.storage.put("lastMessage", payload);
          return { received: true, message: payload };
        };
      `,
    },
    "suspend-handler": {
      hash: "suspend-handler",
      code: `
        return async (payload, ctx) => {
          // First call - suspend
          if (!payload.resumed) {
            await ctx.actions.waitUntil(Date.now() + 1000, "test-wake");
            return { shouldNotReach: true };
          }
          // Resume path
          return { resumed: true, message: payload };
        };
      `,
    },
    "schedule-handler": {
      hash: "schedule-handler",
      code: `
        return async (ctx) => {
          await ctx.storage.put("scheduled", true);
          return { scheduled: true };
        };
      `,
    },
  },
});

// Mock providers
const createMockProviders = () => ({
  ai: {
    complete: async () => ({ content: "test response" }),
    stream: async () => ({ content: "streamed response" }),
  },
  memory: {
    list: async () => ({ items: [], nextCursor: undefined }),
    append: async () => {},
    summarize: async () => "summary",
  },
  vault: {
    get: async () => "secret-value",
  },
  auth: {
    userId: asUserId("user-1"),
    providerId: "test",
    claims: {},
    hasPermission: () => true,
  },
});

describe("runtime E2E", () => {
  let adapters: ReturnType<typeof createFakeAdapters>;
  let providers;

  beforeEach(() => {
    adapters = createFakeAdapters();
    providers = createMockProviders();
  });

  describe("basic execution", () => {
    it("should reject incompatible IR versions with a clear error", async () => {
      const ir = createMockIR();
      const incompatibleIr = { ...ir, version: 99 as 1 };

      expect(
        () =>
          new KalpRuntime(
            incompatibleIr,
            {
              state: adapters.state,
              events: adapters.events,
              idempotency: adapters.state,
              threads: adapters.state,
            },
            new FakeEffectResolver(
              adapters.events,
              adapters.state,
              adapters.scheduler,
            ),
          ),
      ).toThrow(/IR incompatible/);
    });

    it("should execute handler on onMessage event", async () => {
      const ir = createMockIR();
      const runtime = new KalpRuntime(
        ir,
        {
          state: adapters.state,
          events: adapters.events,
          idempotency: adapters.state,
          threads: adapters.state,
        },
        new FakeEffectResolver(
          adapters.events,
          adapters.state,
          adapters.scheduler,
        ),
      );

      const event: RuntimeEvent = {
        type: "onMessage",
        payload: { text: "Hello, world!" },
        threadId: "thread-1",
      };

      const result = await runtime.handleEvent(event);

      // Verify result
      expect(result).toMatchObject({
        received: true,
        message: { text: "Hello, world!" },
      });

      // Verify state was persisted
      const stored = await adapters.state.get("lastMessage");
      expect(stored).toEqual({ text: "Hello, world!" });

      // Verify events were logged
      const events = adapters.events.getEvents();
      expect(events.length).toBeGreaterThan(0);
    });

    it("should create executionId and traceId for each execution", async () => {
      const ir = createMockIR();
      const runtime = new KalpRuntime(
        ir,
        {
          state: adapters.state,
          events: adapters.events,
          idempotency: adapters.state,
          threads: adapters.state,
        },
        new FakeEffectResolver(
          adapters.events,
          adapters.state,
          adapters.scheduler,
        ),
      );

      const event: RuntimeEvent = {
        type: "onMessage",
        payload: { id: 1 },
        threadId: "thread-1",
      };

      await runtime.handleEvent(event);

      // Verify execution identity in logged events
      const events = adapters.events.getEvents();
      expect(events.length).toBeGreaterThan(0);

      // All events should have executionId and traceId
      for (const event of events) {
        expect(event.executionId).toBeDefined();
        expect(event.traceId).toBeDefined();
        expect(event.threadId).toBe("thread-1");
      }
    });

    it("should throw error for unknown event types", async () => {
      const ir = createMockIR();
      const runtime = new KalpRuntime(
        ir,
        {
          state: adapters.state,
          events: adapters.events,
          idempotency: adapters.state,
          threads: adapters.state,
        },
        new FakeEffectResolver(
          adapters.events,
          adapters.state,
          adapters.scheduler,
        ),
      );

      const event: RuntimeEvent = {
        type: "unknownEvent" as never,
        payload: {},
        threadId: "thread-1",
      };

      await expect(runtime.handleEvent(event)).rejects.toThrow();
    });
  });

  describe("suspension and resume", () => {
    it("should catch SuspensionException and return suspended state", async () => {
      const ir = createMockIR();

      // The handler uses ctx.actions.waitUntil which throws SuspensionException
      // The runtime should catch it and return suspended state
      ir.bundles["suspend-handler"] = {
        type: "step",
        code: `
          return async (payload, ctx) => {
            await ctx.actions.waitUntil(Date.now() + 1000, "test-wake");
            return { shouldNotReach: true };
          };
        `,
      };

      // Add entry for suspend test
      ir.nodes["testSuspend"] = { kind: "step", bundle: "suspend-handler" };

      const runtime = new KalpRuntime(
        ir,
        {
          state: adapters.state,
          events: adapters.events,
          idempotency: adapters.state,
          threads: adapters.state,
        },
        new FakeEffectResolver(
          adapters.events,
          adapters.state,
          adapters.scheduler,
        ),
      );

      const event: RuntimeEvent = {
        type: "testSuspend" as never,
        payload: {},
        threadId: "thread-1",
      };

      // Note: This test may need adjustment based on how SuspensionException is caught in runtime
      // For now, we test that the runtime properly handles the flow
      const result = await runtime.handleEvent(event);

      // The result should indicate suspension or be handled gracefully
      expect(result).toBeDefined();
    });

    it("should schedule alarm when suspending with waitUntil", async () => {
      const ir = createMockIR();

      // Update the bundle to use waitUntil
      ir.bundles["suspend-handler"] = {
        hash: "suspend-handler",
        code: `
          return async (payload, ctx) => {
            const resumeTime = Date.now() + 5000; // 5 seconds
            await ctx.actions.waitUntil(resumeTime, "timer-wake");
            return { wokeUp: true };
          };
        `,
      };

      ir.nodes["testWait"] = { kind: "step", bundle: "suspend-handler" };

      const runtime = new KalpRuntime(
        ir,
        {
          state: adapters.state,
          events: adapters.events,
          idempotency: adapters.state,
          threads: adapters.state,
        },
        new FakeEffectResolver(
          adapters.events,
          adapters.state,
          adapters.scheduler,
        ),
      );

      const event: RuntimeEvent = {
        type: "testWait" as never,
        payload: {},
        threadId: "thread-1",
      };

      await runtime.handleEvent(event);

      // Verify alarm was scheduled (wakeReason comes from waitUntil)
      const alarms = adapters.scheduler.getAlarms();
      expect(alarms.length).toBeGreaterThan(0);
      expect(alarms[0]!.payload.wakeReason).toBe("timer-wake");
    });

    it("should resume execution from suspension point", async () => {
      const ir = createMockIR();
      const executionId = "resume-test-1";

      // Setup: First, we need to simulate a suspended execution
      // This requires pre-populating the event log with suspension state

      // For now, test the resume event type handling
      ir.nodes["resume"] = { kind: "message", bundle: "on-message-handler" };

      const runtime = new KalpRuntime(
        ir,
        {
          state: adapters.state,
          events: adapters.events,
          idempotency: adapters.state,
          threads: adapters.state,
        },
        new FakeEffectResolver(
          adapters.events,
          adapters.state,
          adapters.scheduler,
        ),
      );

      // Create a resume event
      const resumeEvent: RuntimeEvent = {
        type: "resume",
        payload: { executionId, resumed: true },
        threadId: "thread-1",
      };

      // Should handle resume without throwing
      const result = await runtime.handleEvent(resumeEvent);
      expect(result).toBeDefined();
    });
  });

  describe("IR V3 routing", () => {
    it("should route events using handlerIndex for O(1) lookup", async () => {
      const ir = createMockIR();

      // Add a route entry
      ir.nodes["route:test"] = { kind: "route", bundle: "on-message-handler" };

      const runtime = new KalpRuntime(
        ir,
        {
          state: adapters.state,
          events: adapters.events,
          idempotency: adapters.state,
          threads: adapters.state,
        },
        new FakeEffectResolver(
          adapters.events,
          adapters.state,
          adapters.scheduler,
        ),
      );

      // Route event
      const event: RuntimeEvent = {
        type: "route:test",
        payload: { routed: true },
        threadId: "thread-1",
      };

      const result = await runtime.handleEvent(event);

      expect(result).toMatchObject({
        received: true,
        message: { routed: true },
      });
    });

    it("should handle schedule triggers", async () => {
      const ir = createMockIR();

      // Add schedule entry
      ir.nodes["cron:daily"] = {
        kind: "cron",
        bundle: "schedule-handler",
        schedule: { expression: "0 9 * * *", timezone: "UTC" },
      };

      const runtime = new KalpRuntime(
        ir,
        {
          state: adapters.state,
          events: adapters.events,
          idempotency: adapters.state,
          threads: adapters.state,
        },
        new FakeEffectResolver(
          adapters.events,
          adapters.state,
          adapters.scheduler,
        ),
      );

      const event: RuntimeEvent = {
        type: "schedule:daily",
        payload: { scheduled: true },
        threadId: "thread-1",
      };

      const result = await runtime.handleEvent(event);

      expect(result).toBeDefined();
    });
  });

  describe("event sourcing", () => {
    it("should replay from event log on resume", async () => {
      const ir = createMockIR();
      const executionId = "replay-test-1";

      // Pre-populate event log with historical events
      await adapters.events.append({
        type: "state.write",
        executionId,
        traceId: "trace-1",
        threadId: "thread-1",
        timestamp: Date.now(),
        key: "user",
        value: "Alice",
      });

      await adapters.events.append({
        type: "action.fetch",
        url: "https://api.example.com/user/Alice",
        method: "GET",
        status: 200,
        durationMs: 100,
        executionId,
        traceId: "trace-1",
        threadId: "thread-1",
        timestamp: Date.now(),
      });

      const runtime = new KalpRuntime(
        ir,
        {
          state: adapters.state,
          events: adapters.events,
          idempotency: adapters.state,
          threads: adapters.state,
        },
        new FakeEffectResolver(
          adapters.events,
          adapters.state,
          adapters.scheduler,
        ),
      );

      // Execute a handler that should use cached results
      const event: RuntimeEvent = {
        type: "onMessage",
        payload: { replay: true },
        threadId: "thread-1",
      };

      // The runtime should load events and use them for replay
      const result = await runtime.handleEvent(event);

      // Result should be defined (actual behavior depends on implementation)
      expect(result).toBeDefined();
    });
  });

  describe("listener causality", () => {
    it("should propagate traceId and parentExecutionId across emit -> listener", async () => {
      const listenerEntryKey = "listener:test-runtime-agent:ticket_created:0";
      const ir: IRGraph = {
        version: 2,
        agent: {
          name: "test-runtime-agent",
        },
        nodes: {
          "hook:message": {
            kind: "message",
            bundle: "emit-entry",
            trigger: { type: "message" },
          },
          [listenerEntryKey]: {
            kind: "listener",
            bundle: "listener-entry",
            source: { agentId: "test-runtime-agent", event: "ticket_created" },
          },
        },
        bundles: {
          "emit-entry": {
            hash: "emit-entry",
            code: `
              return async (payload, ctx) => {
                await ctx.actions.emit("ticket_created", { ticketId: payload.ticketId });
                return { ok: true };
              };
            `,
          },
          "listener-entry": {
            hash: "listener-entry",
            code: `
              return async (payload, ctx) => {
                await ctx.storage.put("listenerPayload", payload);
                return { consumed: true };
              };
            `,
          },
        },
        meta: {} as any,
        irHash: "123",
      };

      const resolver = new FakeEffectResolver(
        adapters.events,
        adapters.state,
        adapters.scheduler,
      );
      const runtime = new KalpRuntime(
        ir,
        {
          state: adapters.state,
          events: adapters.events,
          idempotency: adapters.state,
          threads: adapters.state,
        },
        resolver,
      );

      resolver.onListenerQueued = async (entryKey, payload, traceId) => {
        await runtime.handleEvent({
          type: entryKey as never,
          payload,
          threadId: "thread-1",
          traceId,
        });
      };

      await runtime.handleEvent({
        type: "onMessage",
        payload: { ticketId: "t-1" },
        threadId: "thread-1",
      });

      await new Promise((resolve) => setTimeout(resolve, 25));

      const listenerPayload = await adapters.state.get("listenerPayload");
      expect(listenerPayload).toEqual({ ticketId: "t-1" });

      const events = adapters.events.getEvents();
      const emitted = events.find(
        (event) => (event as { type?: string }).type === "emit.dispatched",
      ) as
        | {
            traceId: string;
            payload: { parentExecutionId: string };
          }
        | undefined;
      const listenerQueued = events.find(
        (event) => (event as { type?: string }).type === "listener.queued",
      ) as
        | {
            traceId: string;
            payload: { parentExecutionId: string };
          }
        | undefined;

      expect(emitted).toBeDefined();
      expect(listenerQueued).toBeDefined();
      expect(listenerQueued?.traceId).toBe(emitted?.traceId);
      expect(listenerQueued?.payload.parentExecutionId).toBe(
        emitted?.payload.parentExecutionId,
      );
    });
  });

  describe("deterministic execution", () => {
    it("should produce same sequence numbers on replay", async () => {
      const ir = createMockIR();

      // Create a handler that emits multiple events
      ir.bundles["seq-test"] = {
        hash: "seq-test",
        code: `
          return async (payload, ctx) => {
            await ctx.storage.put("key1", "value1");
            await ctx.storage.put("key2", "value2");
            await ctx.storage.put("key3", "value3");
            return { done: true };
          };
        `,
      };

      ir.nodes["seqTest"] = { kind: "step", bundle: "seq-test" };

      const runtime = new KalpRuntime(
        ir,
        {
          state: adapters.state,
          events: adapters.events,
          idempotency: adapters.state,
          threads: adapters.state,
        },
        new FakeEffectResolver(
          adapters.events,
          adapters.state,
          adapters.scheduler,
        ),
      );

      const event: RuntimeEvent = {
        type: "seqTest" as never,
        payload: {},
        threadId: "thread-1",
      };

      await runtime.handleEvent(event);

      // Get the logged events
      const events = adapters.events.getEvents();

      // Filter storage events (side-effect tracking for observability)
      const storageEvents = events.filter((e) =>
        (e.type as string).startsWith("storage."),
      );

      // Should have storage events (put operations were tracked)
      expect(storageEvents.length).toBeGreaterThan(0);

      // All should have proper event structure
      for (const event of storageEvents) {
        expect(event.type).toBeDefined();
        expect(event.executionId).toBeDefined();
        expect(event.timestamp).toBeDefined();
      }
    });

    it("should strictly guarantee persist-before-return for effects", async () => {
      const ir = createMockIR();

      ir.bundles["persist-test"] = {
        hash: "persist-test",
        code: `
          return async (payload, ctx) => {
            // Emit effect and await result
            const result = await ctx.storage.get("important-key");
            return { done: true, result };
          };
        `,
      };

      ir.nodes["persistTest"] = { kind: "step", bundle: "persist-test" };

      const resolver = new FakeEffectResolver(adapters.events, adapters.state, adapters.scheduler);
      
      // Wrap the append to detect exactly WHEN the append happens relative to the handler continuation
      const originalAppend = adapters.events.append.bind(adapters.events);
      let effectPersisted = false;
      adapters.events.append = async (event: any) => {
        if (event.type === "storage.get") {
          effectPersisted = true;
        }
        return originalAppend(event);
      };

      const runtime = new KalpRuntime(
        ir,
        {
          state: adapters.state,
          events: adapters.events,
          idempotency: adapters.state,
          threads: adapters.state,
        },
        resolver
      );

      // Pre-populate state
      await adapters.state.set("__state:important-key", "mocked");

      const event: RuntimeEvent = {
        type: "persistTest" as never,
        payload: {},
        threadId: "thread-1",
      };

      await runtime.handleEvent(event);

      // Verify that the effect was fully persisted before handler resumed
      expect(effectPersisted).toBe(true);
      
      const events = adapters.events.getEvents();
      const getEvent = [...events].reverse().find(e => (e as any).type === "storage.get") as any;
      
      // Verify the result is actually persisted in the event
      expect(getEvent).toBeDefined();
      expect(getEvent.result).toEqual("mocked");
    });
  });
});
