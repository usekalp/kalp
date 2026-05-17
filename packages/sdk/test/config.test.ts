import { describe, expect, it } from "vitest";
import { defineConfig, type UserId } from "../src";
import type { JwtPayload } from "../src";

describe("defineConfig", () => {
  it("returns config unchanged", () => {
    const config = defineConfig({
      secrets: ["OPENAI_API_KEY"],
    });
    expect(config).toEqual({ secrets: ["OPENAI_API_KEY"] });
  });

  it("handles empty secrets", () => {
    const config = defineConfig({ secrets: [] });
    expect(config.secrets).toEqual([]);
  });

  it("supports identity configuration", () => {
    const config = defineConfig({
      secrets: ["KEY"],
      identity: {
        id: "main",
        strategy: {
          type: "jwks",
          jwksUrl: "https://example.com/.well-known/jwks.json",
        },
        mapIdentity: (payload: JwtPayload) => ({
          userId: payload.sub as UserId,
          claims: {},
        }),
      },
    });
    expect(config.identity).toBeDefined();
    expect(config.identity?.id).toBe("main");
  });

  it("supports enforceGlobalAuth flag", () => {
    const config = defineConfig({
      secrets: ["KEY"],
      enforceGlobalAuth: true,
    });
    expect(config.enforceGlobalAuth).toBe(true);
  });

  it("supports AI provider configuration", () => {
    const config = defineConfig({
      secrets: ["OPENAI_API_KEY"],
      ai: {
        provider: "openai",
        defaultModel: "gpt-4o-mini",
      },
    });

    expect(config.ai?.provider).toBe("openai");
    expect(config.ai?.defaultModel).toBe("gpt-4o-mini");
  });
});
