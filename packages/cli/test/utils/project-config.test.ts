import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("jiti", () => ({
  createJiti: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  access: vi.fn(),
}));

import { createJiti } from "jiti";
import { access } from "node:fs/promises";
import {
  loadProjectConfig,
  resolveRuntimeIdentityConfig,
  resolveIdentityAuthRequirements,
} from "@/utils/project-config";
import type { RuntimeIdentityConfig } from "@/utils/project-config";
import type { UserId } from "@kalphq/sdk";

function mockJitiImport(moduleValue: unknown) {
  const mockImport = vi.fn().mockResolvedValue(moduleValue);
  vi.mocked(createJiti).mockReturnValue({ import: mockImport } as unknown as ReturnType<typeof createJiti>);
  return mockImport;
}

describe("loadProjectConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads config with default export (interopDefault)", async () => {
    vi.mocked(access).mockResolvedValue(undefined);
    mockJitiImport({ default: { name: "test", version: "1.0" } });

    const result = await loadProjectConfig("/project");

    expect(result.raw).toEqual({ name: "test", version: "1.0" });
    expect(result.path).toContain("kalp.config.ts");
  });

  it("loads config without default key (direct exports)", async () => {
    vi.mocked(access).mockResolvedValue(undefined);
    mockJitiImport({ name: "direct-export" });

    const result = await loadProjectConfig("/project");

    expect(result.raw).toEqual({ name: "direct-export" });
  });

  it("propagates access error when config file does not exist", async () => {
    const error = new Error("ENOENT: no such file");
    vi.mocked(access).mockRejectedValue(error);

    await expect(loadProjectConfig("/project")).rejects.toThrow("ENOENT");
  });

  it("handles null module value", async () => {
    vi.mocked(access).mockResolvedValue(undefined);
    mockJitiImport(null);

    const result = await loadProjectConfig("/project");

    expect(result.raw).toBeNull();
  });

  it("handles module with default set to null (falls through)", async () => {
    vi.mocked(access).mockResolvedValue(undefined);
    mockJitiImport({ default: null, extra: "fallback" });

    const result = await loadProjectConfig("/project");

    expect(result.raw).toEqual({ default: null, extra: "fallback" });
  });

  it("handles function module value (not an object)", async () => {
    vi.mocked(access).mockResolvedValue(undefined);
    const fn = () => {};
    mockJitiImport(fn);

    const result = await loadProjectConfig("/project");

    expect(result.raw).toBe(fn);
  });
});

describe("resolveRuntimeIdentityConfig", () => {
  it("returns defaults for an empty raw config", () => {
    const result = resolveRuntimeIdentityConfig({});

    expect(result).toEqual({
      enforceGlobalAuth: true,
      identityId: null,
      strategy: null,
    });
  });

  it("honors enforceGlobalAuth set to false", () => {
    const result = resolveRuntimeIdentityConfig({
      enforceGlobalAuth: false,
    });

    expect(result.enforceGlobalAuth).toBe(false);
  });

  it("defaults enforceGlobalAuth to true when not a boolean", () => {
    const result = resolveRuntimeIdentityConfig({
      enforceGlobalAuth: "not-a-bool",
    });

    expect(result.enforceGlobalAuth).toBe(true);
  });

  it("returns null strategy when identity has no strategy", () => {
    const result = resolveRuntimeIdentityConfig({
      identity: {
        id: "main",
        mapIdentity: () => ({ userId: "x" as UserId, claims: {} }),
      },
    });

    expect(result.strategy).toBeNull();
    expect(result.identityId).toBe("main");
  });

  it("extracts jwks strategy details", () => {
    const jwksStrategy = {
      type: "jwks" as const,
      jwksUrl: "https://auth.example.com/.well-known/jwks.json",
      issuer: "https://auth.example.com",
      audience: "my-api",
    };

    const result = resolveRuntimeIdentityConfig({
      identity: {
        id: "main",
        strategy: jwksStrategy,
        mapIdentity: () => ({ userId: "x" as UserId, claims: {} }),
      },
    });

    expect(result.strategy).toEqual({
      type: "jwks",
      jwksUrl: "https://auth.example.com/.well-known/jwks.json",
      issuer: "https://auth.example.com",
      audience: "my-api",
    });
  });

  it("extracts symmetric strategy details", () => {
    const result = resolveRuntimeIdentityConfig({
      identity: {
        id: "sym",
        strategy: { type: "symmetric" as const, secretEnvKey: "MY_SECRET" },
        mapIdentity: () => ({ userId: "x" as UserId, claims: {} }),
      },
    });

    expect(result.strategy).toEqual({
      type: "symmetric",
      secretEnvKey: "MY_SECRET",
    });
  });

  it("extracts apiKey strategy details", () => {
    const result = resolveRuntimeIdentityConfig({
      identity: {
        id: "api",
        strategy: {
          type: "apiKey" as const,
          headerName: "x-custom-key",
          envKey: "MY_API_KEY",
        },
        mapIdentity: () => ({ userId: "x" as UserId, claims: {} }),
      },
    });

    expect(result.strategy).toEqual({
      type: "apiKey",
      headerName: "x-custom-key",
      envKey: "MY_API_KEY",
    });
  });

  it("returns null identityId when id is empty string", () => {
    const result = resolveRuntimeIdentityConfig({
      identity: {
        id: "",
        strategy: { type: "jwks" as const, jwksUrl: "https://example.com" },
        mapIdentity: () => ({ userId: "x" as UserId, claims: {} }),
      },
    });

    expect(result.identityId).toBeNull();
  });

  it("returns null identityId when id is not a string", () => {
    const result = resolveRuntimeIdentityConfig({
      identity: {
        id: 123 as unknown as string,
        strategy: { type: "jwks" as const, jwksUrl: "https://example.com" },
        mapIdentity: () => ({ userId: "x" as UserId, claims: {} }),
      },
    });

    expect(result.identityId).toBeNull();
  });

  it("returns null strategy when identity is not an object", () => {
    const result = resolveRuntimeIdentityConfig({ identity: "not-an-object" });

    expect(result.strategy).toBeNull();
    expect(result.identityId).toBeNull();
  });
});

describe("resolveIdentityAuthRequirements", () => {
  const makeConfig = (
    overrides: Partial<RuntimeIdentityConfig> = {},
  ): RuntimeIdentityConfig => ({
    enforceGlobalAuth: true,
    identityId: "test",
    strategy: null,
    ...overrides,
  });

  it("returns empty array when there is no strategy", () => {
    const config = makeConfig({ strategy: null });

    const result = resolveIdentityAuthRequirements(config);

    expect(result).toEqual([]);
  });

  it("returns empty array for jwks strategy (no secrets needed)", () => {
    const config = makeConfig({
      strategy: {
        type: "jwks",
        jwksUrl: "https://example.com/.well-known/jwks.json",
      },
    });

    const result = resolveIdentityAuthRequirements(config);

    expect(result).toEqual([]);
  });

  it("returns env requirement for symmetric strategy with explicit secretEnvKey", () => {
    const config = makeConfig({
      strategy: { type: "symmetric", secretEnvKey: "MY_JWT_KEY" },
    });

    const result = resolveIdentityAuthRequirements(config);

    expect(result).toEqual([
      { envKey: "MY_JWT_KEY", reason: "symmetric JWT validation" },
    ]);
  });

  it("returns default env key for symmetric strategy without secretEnvKey", () => {
    const config = makeConfig({
      strategy: { type: "symmetric", secretEnvKey: "" },
    });

    const result = resolveIdentityAuthRequirements(config);

    expect(result).toEqual([
      { envKey: "JWT_SIGNING_SECRET", reason: "symmetric JWT validation" },
    ]);
  });

  it("returns default env key for symmetric with whitespace-only secretEnvKey", () => {
    const config = makeConfig({
      strategy: { type: "symmetric", secretEnvKey: "   " },
    });

    const result = resolveIdentityAuthRequirements(config);

    expect(result).toEqual([
      { envKey: "JWT_SIGNING_SECRET", reason: "symmetric JWT validation" },
    ]);
  });

  it("returns env requirement for apiKey strategy with explicit envKey", () => {
    const config = makeConfig({
      strategy: { type: "apiKey", envKey: "MY_CUSTOM_KEY" },
    });

    const result = resolveIdentityAuthRequirements(config);

    expect(result).toEqual([
      { envKey: "MY_CUSTOM_KEY", reason: "apiKey strategy" },
    ]);
  });

  it("returns default env key for apiKey strategy without envKey", () => {
    const config = makeConfig({
      strategy: { type: "apiKey", envKey: "" },
    });

    const result = resolveIdentityAuthRequirements(config);

    expect(result).toEqual([
      { envKey: "KALP_API_KEY", reason: "apiKey strategy (default env key)" },
    ]);
  });

  it("returns default env key for apiKey with whitespace-only envKey", () => {
    const config = makeConfig({
      strategy: { type: "apiKey", envKey: "  \t  " },
    });

    const result = resolveIdentityAuthRequirements(config);

    expect(result).toEqual([
      { envKey: "KALP_API_KEY", reason: "apiKey strategy (default env key)" },
    ]);
  });
});
