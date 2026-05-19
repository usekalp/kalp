import { describe, it, expect } from "vitest";
import { createActionsContext } from "../../src/effects/primitives/actions";
import { createInterceptorMock } from "../helpers/interceptor-mock";
import type { LocalActions } from "../../src/effects/primitives";
import type { SyncInterceptor } from "../../src/effects/primitives/types";

const noopSync: SyncInterceptor = <T>(_type: string, _payload: unknown, compute: () => T): T => compute();

describe("createActionsContext", () => {
  it("should run a node via action.run", async () => {
    const { interceptEffect, calls } = createInterceptorMock();
    const actions = createActionsContext(interceptEffect, noopSync);
    await actions.run({ kind: "tool", id: "my-tool" }, { input: 1 });
    expect(calls[0]).toMatchObject({
      type: "action.run",
      payload: { target: "tools.my-tool", input: { input: 1 } },
    });
  });

  it("should call local listener via localActions.call", async () => {
    const { interceptEffect } = createInterceptorMock();
    const localActions: LocalActions = {
      call: async () => ({ result: 42 }),
      dispatch: async () => ({ eventId: "e1" }),
    };
    const actions = createActionsContext(interceptEffect, noopSync, localActions);
    const result = await actions.call({ __runtimeId: "listener:process" }, { data: 1 });
    expect(result).toEqual({ result: 42 });
  });

  it("should throw on call when localActions missing", () => {
    const { interceptEffect } = createInterceptorMock();
    const actions = createActionsContext(interceptEffect, noopSync);
    expect(() => actions.call({ event: "test" }, {})).toThrow(
      "Local call is not available in this runtime context.",
    );
  });

  it("should dispatch via localActions.dispatch", async () => {
    const { interceptEffect } = createInterceptorMock();
    const localActions: LocalActions = {
      call: async () => undefined,
      dispatch: async () => ({ eventId: "evt_123" }),
    };
    const actions = createActionsContext(interceptEffect, noopSync, localActions);
    const result = await actions.dispatch({ event: "test" }, { data: 1 });
    expect(result).toEqual({ eventId: "evt_123" });
  });

  it("should throw on dispatch when localActions missing", () => {
    const { interceptEffect } = createInterceptorMock();
    const actions = createActionsContext(interceptEffect, noopSync);
    expect(() => actions.dispatch({ event: "test" }, {})).toThrow(
      "Local dispatch is not available in this runtime context.",
    );
  });

  it("should ask via action.ask", async () => {
    const { interceptEffect, calls } = createInterceptorMock();
    const actions = createActionsContext(interceptEffect, noopSync);
    await actions.ask("are you sure?");
    expect(calls[0]).toMatchObject({
      type: "action.ask",
      payload: { prompt: "are you sure?" },
    });
  });

  it("should requestApproval via action.approval", async () => {
    const { interceptEffect } = createInterceptorMock({
      "action.approval": () => ({ approved: true }),
    });
    const actions = createActionsContext(interceptEffect, noopSync);
    const result = await actions.requestApproval("confirm?");
    expect(result).toBe(true);
  });

  it("should callAgent via action.call", async () => {
    const { interceptEffect, calls } = createInterceptorMock();
    const actions = createActionsContext(interceptEffect, noopSync);
    await actions.callAgent({ name: "helper" }, { query: "test" });
    expect(calls[0]).toMatchObject({
      type: "action.call",
      payload: { contract: "helper", input: { query: "test" } },
    });
  });

  it("should sleep via action.sleep", async () => {
    const { interceptEffect, calls } = createInterceptorMock();
    const actions = createActionsContext(interceptEffect, noopSync);
    await actions.sleep({ seconds: 5 });
    expect(calls[0]).toMatchObject({
      type: "action.sleep",
      payload: { duration: { seconds: 5 } },
    });
  });

  it("should waitUntil via action.waitUntil", async () => {
    const { interceptEffect, calls } = createInterceptorMock();
    const actions = createActionsContext(interceptEffect, noopSync);
    await actions.waitUntil(Date.now() + 10000);
    expect(calls[0]!.type).toBe("action.waitUntil");
  });

  it("should fetch via fetch effect", async () => {
    const { interceptEffect, calls } = createInterceptorMock();
    const actions = createActionsContext(interceptEffect, noopSync);
    await actions.fetch("https://example.com", { method: "POST", body: "data" });
    expect(calls[0]).toMatchObject({
      type: "fetch",
      payload: { url: "https://example.com", method: "POST", body: "data" },
    });
  });

  it("should loop via sync interceptor", () => {
    const { interceptSync, calls } = createInterceptorMock();
    const actions = createActionsContext(
      () => Promise.resolve(),
      interceptSync,
    );
    actions.loop(async () => {});
    expect(calls[0]!.type).toBe("action.loop");
  });

  it("should schedule via action.schedule", async () => {
    const { interceptEffect, calls } = createInterceptorMock();
    const actions = createActionsContext(interceptEffect, noopSync);
    await actions.schedule({ kind: "message", id: "test" }, Date.now(), { input: 1 });
    expect(calls[0]!.type).toBe("action.schedule");
  });
});
