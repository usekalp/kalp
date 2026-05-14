import { describe, expect, it, vi } from "vitest";
import { createMockContext } from "./shared";

describe("KalpContext", () => {
  it("exposes all required primitives", () => {
    const ctx = createMockContext();

    expect(typeof ctx.ai.generate).toBe("function");
    expect(typeof ctx.ai.stream).toBe("function");
    expect(typeof ctx.ai.classify).toBe("function");
  });

  it("exposes memory primitive", () => {
    const ctx = createMockContext();

    expect(typeof ctx.memory.list).toBe("function");
    expect(typeof ctx.memory.append).toBe("function");
    expect(typeof ctx.memory.summarize).toBe("function");
  });

  it("exposes vault primitive", async () => {
    const ctx = createMockContext();

    const secret = await ctx.vault.get("TEST_KEY" as never);
    expect(secret).toBe("secret-value");
  });

  it("exposes storage primitive", () => {
    const ctx = createMockContext();

    expect(typeof ctx.storage.get).toBe("function");
    expect(typeof ctx.storage.put).toBe("function");
    expect(typeof ctx.storage.delete).toBe("function");
    expect(typeof ctx.storage.increment).toBe("function");
    expect(typeof ctx.storage.transaction).toBe("function");
  });

  it("exposes auth primitive", () => {
    const ctx = createMockContext();

    expect(ctx.auth.userId).toBeDefined();
    expect(ctx.auth.providerId).toBeDefined();
    expect(typeof ctx.auth.hasPermission).toBe("function");
  });

  it("exposes actions primitive", () => {
    const ctx = createMockContext();

    expect(typeof ctx.actions.run).toBe("function");
    expect(typeof ctx.actions.wait).toBe("function");
    expect(typeof ctx.actions.loop).toBe("function");
    expect(typeof ctx.actions.fetch).toBe("function");
    expect(typeof ctx.actions.ask).toBe("function");
    expect(typeof ctx.actions.requestApproval).toBe("function");
    expect(typeof ctx.actions.emit).toBe("function");
    expect(typeof ctx.actions.callAgent).toBe("function");
  });

  it("exposes log primitive", () => {
    const ctx = createMockContext();

    expect(typeof ctx.log.info).toBe("function");
    expect(typeof ctx.log.warn).toBe("function");
    expect(typeof ctx.log.error).toBe("function");
    expect(typeof ctx.log.debug).toBe("function");
  });
});
