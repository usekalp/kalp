/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach } from "vitest";
import { KalpRuntime } from "../src/engine/runtime";
import { createFakeAdapters } from "./fixtures/fake-adapters";
import type { RuntimeEvent } from "../src/engine/types";
import type { BundleManifest, IRGraph, SchemaRegistry } from "@kalphq/sdk";
import { FakeEffectResolver } from "./fixtures/fake-resolver";

function createMockArtifacts(): {
  ir: IRGraph;
  schemas: SchemaRegistry;
  bundleManifest: BundleManifest;
  bundles: Record<string, string>;
} {
  return {
    ir: {
      schemaVersion: 3,
      requirements: {
        "kalp/state": 1,
        "kalp/listeners": 1,
      },
      agent: {
        name: "test-runtime-agent",
        stateSchema: "schema_state",
      },
      nodes: {
        node_message: {
          id: "node_message",
          stableName: "hook.message",
          kind: "message",
          trigger: { type: "message" },
        },
        node_listener: {
          id: "node_listener",
          stableName: "listener.approval_requested",
          kind: "listener",
          trigger: { type: "listener", event: "approval_requested" },
          listener: { event: "approval_requested" },
        },
        node_contract: {
          id: "node_contract",
          stableName: "contract.approval-service",
          kind: "contract",
          trigger: { type: "rpc", contractName: "approval-service" },
        },
      },
    },
    schemas: {
      schema_state: {
        type: "json-schema",
        source: "zod",
        hash: "schema_state_hash",
        schema: {
          type: "object",
          required: ["processedCount"],
          properties: {
            processedCount: { type: "number", default: 0 },
            lastScore: { type: "number" },
          },
        },
      },
    },
    bundleManifest: {
      schemaVersion: 3,
      targets: {
        default: {
          abiVersion: 1,
          nodes: {
            node_message: {
              bundle: "bundle_message",
              file: "./targets/default/bundles/bundle_message.js",
              size: 0,
              format: "esm",
              entry: "default",
              sha256: "sha_message",
            },
            node_listener: {
              bundle: "bundle_listener",
              file: "./targets/default/bundles/bundle_listener.js",
              size: 0,
              format: "esm",
              entry: "default",
              sha256: "sha_listener",
            },
            node_contract: {
              bundle: "bundle_contract",
              file: "./targets/default/bundles/bundle_contract.js",
              size: 0,
              format: "esm",
              entry: "default",
              sha256: "sha_contract",
            },
          },
        },
      },
    },
    bundles: {
      bundle_message: `
        export default async function handler(payload, ctx) {
          const approvalRequested = { event: "approval_requested", __runtimeId: "listener:approval_requested" };
          ctx.state.processedCount = (ctx.state.processedCount ?? 0) + 1;
          const result = await ctx.actions.emit(approvalRequested, { score: payload.score });
          return { approved: result.approved, count: ctx.state.processedCount };
        }
      `,
      bundle_listener: `
        export default async function handler(payload, ctx) {
          ctx.state.lastScore = payload.score;
          return { approved: payload.score > 80 };
        }
      `,
      bundle_contract: `
        export default async function handler(payload) {
          return { approved: payload.opportunityId === "opp_1" };
        }
      `,
    },
  };
}

describe("runtime E2E", () => {
  let adapters: ReturnType<typeof createFakeAdapters>;
  let resolver: FakeEffectResolver;

  beforeEach(() => {
    adapters = createFakeAdapters();
    resolver = new FakeEffectResolver(adapters.events, adapters.state, adapters.scheduler);
  });

  it("should execute local listeners synchronously via emit and persist state", async () => {
    const artifacts = createMockArtifacts();
    const runtime = new KalpRuntime(
      artifacts.ir,
      artifacts.schemas,
      artifacts.bundleManifest,
      async (binding) => artifacts.bundles[binding.bundle]!,
      {
        state: adapters.state,
        events: adapters.events,
        idempotency: adapters.state,
        threads: adapters.state,
      },
      resolver,
    );

    const event: RuntimeEvent = {
      type: "onMessage",
      payload: { score: 91 },
      threadId: "thread-1",
    };

    const result = await runtime.handleEvent(event);
    expect(result).toEqual({ approved: true, count: 1 });

    const storedState = await adapters.state.get("__kalp_state__");
    expect(storedState).toEqual({ processedCount: 1, lastScore: 91 });
  });

  it("should route contract events to contract nodes", async () => {
    const artifacts = createMockArtifacts();
    const runtime = new KalpRuntime(
      artifacts.ir,
      artifacts.schemas,
      artifacts.bundleManifest,
      async (binding) => artifacts.bundles[binding.bundle]!,
      {
        state: adapters.state,
        events: adapters.events,
        idempotency: adapters.state,
        threads: adapters.state,
      },
      resolver,
    );

    const result = await runtime.handleEvent({
      type: "contract:approval-service",
      payload: { opportunityId: "opp_1" },
      threadId: "thread-1",
    });

    expect(result).toEqual({ approved: true });
  });

  it("should queue detached local dispatches without awaiting output", async () => {
    const artifacts = createMockArtifacts();
    artifacts.bundles.bundle_message = `
      export default async function handler(_payload, ctx) {
        const approvalRequested = { event: "approval_requested", __runtimeId: "listener:approval_requested" };
        await ctx.actions.dispatch(approvalRequested, { score: 50 });
        return { queued: true };
      }
    `;
    artifacts.bundleManifest.targets.default!.nodes.node_message = {
      ...artifacts.bundleManifest.targets.default!.nodes.node_message!,
      sha256: "sha_message_dispatch",
    };

    const runtime = new KalpRuntime(
      artifacts.ir,
      artifacts.schemas,
      artifacts.bundleManifest,
      async (binding) => artifacts.bundles[binding.bundle]!,
      {
        state: adapters.state,
        events: adapters.events,
        idempotency: adapters.state,
        threads: adapters.state,
      },
      resolver,
    );

    const result = await runtime.handleEvent({
      type: "onMessage",
      payload: {},
      threadId: "thread-1",
    });

    expect(result).toEqual({ queued: true });
    const events = adapters.events.getEvents();
    expect(events.some((entry: any) => entry.type === "listener.queued")).toBe(true);
  });

  it("should reject invalid final state against JSON schema", async () => {
    const artifacts = createMockArtifacts();
    artifacts.bundles.bundle_message = `
      export default async function handler(_payload, ctx) {
        ctx.state.processedCount = "broken";
        return { ok: true };
      }
    `;
    artifacts.bundleManifest.targets.default!.nodes.node_message = {
      ...artifacts.bundleManifest.targets.default!.nodes.node_message!,
      sha256: "sha_message_invalid",
    };

    const runtime = new KalpRuntime(
      artifacts.ir,
      artifacts.schemas,
      artifacts.bundleManifest,
      async (binding) => artifacts.bundles[binding.bundle]!,
      {
        state: adapters.state,
        events: adapters.events,
        idempotency: adapters.state,
        threads: adapters.state,
      },
      resolver,
    );

    await expect(
      runtime.handleEvent({
        type: "onMessage",
        payload: {},
        threadId: "thread-1",
      }),
    ).rejects.toThrow(/State validation failed/);
  });
});
