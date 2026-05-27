import type { BundleManifest, IRGraph, SchemaRegistry } from "@kalphq/sdk";
import type { PersistenceAdapter } from "../../src/adapters/interfaces";
import { createFakeAdapters } from "../fixtures/fake-adapters";
import { FakeEffectResolver } from "../fixtures/fake-resolver";

export interface MockArtifacts {
  ir: IRGraph;
  schemas: SchemaRegistry;
  bundleManifest: BundleManifest;
  bundles: Record<string, string>;
}

export function createMockArtifacts(overrides?: Partial<MockArtifacts>): MockArtifacts {
  return {
    ir: {
      schemaVersion: 3,
      agent: { name: "test-agent" },
      nodes: {
        node_message: {
          id: "node_message",
          stableName: "hook.message",
          kind: "message",
          trigger: { type: "message" },
        },
      },
    },
    schemas: {},
    bundleManifest: {
      schemaVersion: 3,
      targets: {
        default: {
          abiVersion: 1,
          nodes: {},
        },
      },
    },
    bundles: {},
    ...overrides,
  };
}

export function createPersistenceAndResolver() {
  const adapters = createFakeAdapters();
  const persistence: PersistenceAdapter = {
    state: adapters.state,
    events: adapters.events,
    idempotency: adapters.state,
    threads: adapters.state,
  };
  const resolver = new FakeEffectResolver(adapters.events, adapters.state, adapters.scheduler);
  return { adapters, persistence, resolver, clearAll: () => adapters.clearAll() };
}
