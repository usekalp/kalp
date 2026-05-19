import { describe, it, expect } from "vitest";
import { createVaultContext } from "../../src/effects/primitives/vault";
import { createInterceptorMock } from "../helpers/interceptor-mock";

describe("createVaultContext", () => {
  it("should get secret via vault.get", async () => {
    const { interceptEffect, calls } = createInterceptorMock({
      "vault.get": () => "secret-value",
    });
    const vault = createVaultContext(interceptEffect);
    const result = await vault.get("API_KEY");
    expect(calls[0]).toMatchObject({ type: "vault.get", payload: { key: "API_KEY" } });
    expect(result).toBe("secret-value");
  });
});
