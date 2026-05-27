import { describe, it, expect, beforeEach } from "vitest";
import { KalpRuntime } from "../../src/engine/runtime";
import { createFakeAdapters } from "../fixtures/fake-adapters";
import { FakeEffectResolver } from "../fixtures/fake-resolver";
import { SuspensionException } from "../../src/engine/suspension";
import type { PersistenceAdapter } from "../../src/adapters/interfaces";
import type { Effect, EffectType, EffectMap } from "../../src/effects/types";

describe("suspension resume", () => {
  let adapters: ReturnType<typeof createFakeAdapters>;

  class SuspendResolver extends FakeEffectResolver {
    constructor() {
      super(adapters.events, adapters.state, adapters.scheduler);
    }

    async resolve<T extends EffectType>(
      effect: Effect<T>,
    ): Promise<EffectMap[T]["result"]> {
      if (effect.type === "action.waitUntil") {
        const { until } =
          effect.payload as EffectMap["action.waitUntil"]["payload"];
        throw new SuspensionException(until, "timer-wake", {}, effect.seq);
      }
      if (effect.type === "cache.get") {
        return undefined as EffectMap[T]["result"];
      }
      if (effect.type === "cache.set") {
        return undefined as EffectMap[T]["result"];
      }
      return undefined as EffectMap[T]["result"];
    }
  }

  beforeEach(() => {
    adapters = createFakeAdapters();
  });

  it("should suspend and persist execution.suspended event", async () => {
    const persistence: PersistenceAdapter = {
      state: adapters.state,
      events: adapters.events,
      idempotency: adapters.state,
      threads: adapters.state,
    };
    const resolver = new SuspendResolver();

    const futureTime = Date.now() + 60000;
    const runtime = new KalpRuntime(
      {
        schemaVersion: 3,
        agent: { name: "test" },
        nodes: {
          n_msg: {
            id: "n_msg",
            stableName: "hook.message",
            kind: "message",
            trigger: { type: "message" },
          },
        },
      },
      {},
      {
        schemaVersion: 3,
        targets: {
          default: {
            abiVersion: 1,
            nodes: {
              n_msg: {
                bundle: "b1",
                file: "f.js",
                size: 0,
                format: "esm",
                entry: "default",
                sha256: "s1",
              },
            },
          },
        },
      },
      async () =>
        `export default async (_p, ctx) => { await ctx.actions.waitUntil(${futureTime}); return 'done'; }`,
      persistence,
      resolver,
    );

    const result = await runtime.handleEvent({
      type: "onMessage",
      payload: {},
      threadId: "th1",
    });
    expect(result).toMatchObject({ suspended: true, until: futureTime });
  });
});
