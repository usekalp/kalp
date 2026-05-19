import { describe, it, expect } from "vitest";
import { createStorageContext } from "../../src/effects/primitives/storage";
import { createInterceptorMock } from "../helpers/interceptor-mock";

describe("createStorageContext", () => {
  it("should call storage.get with key", async () => {
    const { interceptEffect, calls } = createInterceptorMock();
    const storage = createStorageContext(interceptEffect);
    await storage.get("my-key");
    expect(calls[0]).toMatchObject({ type: "storage.get", payload: { key: "my-key" } });
  });

  it("should call storage.put with key and value", async () => {
    const { interceptEffect, calls } = createInterceptorMock();
    const storage = createStorageContext(interceptEffect);
    await storage.put("k", { foo: 1 });
    expect(calls[0]).toMatchObject({ type: "storage.put", payload: { key: "k", value: { foo: 1 } } });
  });

  it("should call storage.delete with key", async () => {
    const { interceptEffect, calls } = createInterceptorMock();
    const storage = createStorageContext(interceptEffect);
    await storage.delete("k");
    expect(calls[0]).toMatchObject({ type: "storage.delete", payload: { key: "k" } });
  });

  it("should call storage.increment with key and amount", async () => {
    const { interceptEffect, calls } = createInterceptorMock();
    const storage = createStorageContext(interceptEffect);
    await storage.increment("counter", 5);
    expect(calls[0]).toMatchObject({ type: "storage.increment", payload: { key: "counter", amount: 5 } });
  });

  it("should call storage.increment with default amount", async () => {
    const { interceptEffect, calls } = createInterceptorMock();
    const storage = createStorageContext(interceptEffect);
    await storage.increment("counter");
    expect(calls[0]).toMatchObject({ type: "storage.increment", payload: { key: "counter", amount: undefined } });
  });

  it("should execute transaction and batch operations", async () => {
    const { interceptEffect, calls } = createInterceptorMock();
    const storage = createStorageContext(interceptEffect);
    const result = await storage.transaction(async (tx) => {
      tx.put("k1", "v1");
      tx.delete("k2");
      return "done";
    });
    expect(result).toBe("done");
    expect(calls[0]).toMatchObject({
      type: "storage.batch",
      payload: {
        operations: [
          { op: "put", key: "k1", value: "v1" },
          { op: "delete", key: "k2" },
        ],
      },
    });
  });

  it("should skip batch when transaction has no operations", async () => {
    const { interceptEffect, calls } = createInterceptorMock();
    const storage = createStorageContext(interceptEffect);
    await storage.transaction(async () => "noop");
    expect(calls).toHaveLength(0);
  });
});
