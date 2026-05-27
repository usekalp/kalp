import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockReadFile, mockWriteFile, mockExtractEnvName } = vi.hoisted(() => ({
  mockReadFile: vi.fn(),
  mockWriteFile: vi.fn(),
  mockExtractEnvName: vi.fn(),
}));

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return { ...actual, readFile: mockReadFile, writeFile: mockWriteFile };
});

vi.mock("@kalphq/sdk", async (importOriginal) => {
  const mock = { extractEnvName: mockExtractEnvName };
  try {
    const actual = await importOriginal<typeof import("@kalphq/sdk")>();
    return { ...actual, extractEnvName: mockExtractEnvName };
  } catch {
    return mock;
  }
});

import { injectRuntimeConfigs } from "@/utils/runtime-config-inject";
import type { RuntimeIdentityConfig } from "@/utils/project-config";

describe("runtime-config-inject", () => {
  const baseWranglerConfig = {
    name: "test-worker",
    main: "index.ts",
    vars: { KALP_ENV: "production" },
  };

  const baseIdentityConfig: RuntimeIdentityConfig = {
    enforceGlobalAuth: true,
    identityId: "identity-1",
    strategy: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockReadFile.mockResolvedValue(JSON.stringify(baseWranglerConfig, null, 2) + "\n");
    mockWriteFile.mockResolvedValue(undefined);
  });

  function getWrittenVars() {
    const call = mockWriteFile.mock.calls[0];
    expect(call).toBeDefined();
    const writtenContent = call[1] as string;
    const parsed = JSON.parse(writtenContent);
    return (parsed.vars ?? {}) as Record<string, string>;
  }

  describe("AI config injection", () => {
    it("injects KALP_AI_CONFIG with model tiers", async () => {
      await injectRuntimeConfigs({
        wranglerConfigPath: "/tmp/wrangler.jsonc",
        aiRaw: { models: { tier1: "gpt-4", tier2: "claude-3" } },
        identityConfig: baseIdentityConfig,
        mcpRaw: undefined,
        envMap: {},
      });

      const vars = getWrittenVars();
      const aiConfig = JSON.parse(vars.KALP_AI_CONFIG!);
      expect(aiConfig.models).toEqual({ tier1: "gpt-4", tier2: "claude-3" });
    });

    it("includes gatewayId when present in AI config", async () => {
      await injectRuntimeConfigs({
        wranglerConfigPath: "/tmp/wrangler.jsonc",
        aiRaw: { models: { tier1: "gpt-4" }, gatewayId: "custom-gateway" },
        identityConfig: baseIdentityConfig,
        mcpRaw: undefined,
        envMap: {},
      });

      const vars = getWrittenVars();
      const aiConfig = JSON.parse(vars.KALP_AI_CONFIG!);
      expect(aiConfig.models).toEqual({ tier1: "gpt-4" });
      expect(aiConfig.gatewayId).toBe("custom-gateway");
    });

    it("includes system/fallback config when present", async () => {
      await injectRuntimeConfigs({
        wranglerConfigPath: "/tmp/wrangler.jsonc",
        aiRaw: {
          models: { tier1: "gpt-4" },
          system: { prompt: "You are helpful" },
          fallback: { model: "fallback-model" },
        },
        identityConfig: baseIdentityConfig,
        mcpRaw: undefined,
        envMap: {},
      });

      const vars = getWrittenVars();
      const aiConfig = JSON.parse(vars.KALP_AI_CONFIG!);
      expect(aiConfig.system).toEqual({ prompt: "You are helpful" });
      expect(aiConfig.fallback).toEqual({ model: "fallback-model" });
    });

    it("handles missing ai config gracefully", async () => {
      await injectRuntimeConfigs({
        wranglerConfigPath: "/tmp/wrangler.jsonc",
        aiRaw: undefined,
        identityConfig: baseIdentityConfig,
        mcpRaw: undefined,
        envMap: {},
      });

      const vars = getWrittenVars();
      expect(vars.KALP_AI_CONFIG).toBeUndefined();
      expect(vars.KALP_IDENTITY_CONFIG).toBeDefined();
    });

    it("handles ai config without models key", async () => {
      await injectRuntimeConfigs({
        wranglerConfigPath: "/tmp/wrangler.jsonc",
        aiRaw: { gatewayId: "some-gateway" },
        identityConfig: baseIdentityConfig,
        mcpRaw: undefined,
        envMap: {},
      });

      const vars = getWrittenVars();
      expect(vars.KALP_AI_CONFIG).toBeUndefined();
    });
  });

  describe("Identity config injection", () => {
    it("injects KALP_IDENTITY_CONFIG with identity config", async () => {
      const identityConfig: RuntimeIdentityConfig = {
        enforceGlobalAuth: false,
        identityId: "my-identity",
        strategy: {
          type: "apiKey",
          headerName: "x-api-key",
          envKey: "API_KEY",
        },
      };

      await injectRuntimeConfigs({
        wranglerConfigPath: "/tmp/wrangler.jsonc",
        aiRaw: undefined,
        identityConfig,
        mcpRaw: undefined,
        envMap: {},
      });

      const vars = getWrittenVars();
      const parsed = JSON.parse(vars.KALP_IDENTITY_CONFIG!);
      expect(parsed.enforceGlobalAuth).toBe(false);
      expect(parsed.identityId).toBe("my-identity");
      expect(parsed.strategy.type).toBe("apiKey");
    });

    it("handles null identity (still injects the JSON)", async () => {
      const emptyIdentity: RuntimeIdentityConfig = {
        enforceGlobalAuth: true,
        identityId: null,
        strategy: null,
      };

      await injectRuntimeConfigs({
        wranglerConfigPath: "/tmp/wrangler.jsonc",
        aiRaw: undefined,
        identityConfig: emptyIdentity,
        mcpRaw: undefined,
        envMap: {},
      });

      const vars = getWrittenVars();
      const parsed = JSON.parse(vars.KALP_IDENTITY_CONFIG!);
      expect(parsed.identityId).toBeNull();
      expect(parsed.strategy).toBeNull();
    });
  });

  describe("MCP config injection", () => {
    it("injects KALP_MCP_CONFIG with MCP server configs", async () => {
      await injectRuntimeConfigs({
        wranglerConfigPath: "/tmp/wrangler.jsonc",
        aiRaw: undefined,
        identityConfig: baseIdentityConfig,
        mcpRaw: {
          github: { url: "https://mcp.github.com" },
          filesystem: { url: "https://mcp.filesystem.com" },
        },
        envMap: {},
      });

      const vars = getWrittenVars();
      expect(vars.KALP_MCP_CONFIG).toBeDefined();
      const mcpConfig = JSON.parse(vars.KALP_MCP_CONFIG!);
      expect(mcpConfig.github.url).toBe("https://mcp.github.com");
      expect(mcpConfig.filesystem.url).toBe("https://mcp.filesystem.com");
    });

    it("handles MCP servers with bearer auth (resolves env markers)", async () => {
      mockExtractEnvName.mockReturnValue("GITHUB_TOKEN");

      await injectRuntimeConfigs({
        wranglerConfigPath: "/tmp/wrangler.jsonc",
        aiRaw: undefined,
        identityConfig: baseIdentityConfig,
        mcpRaw: {
          github: {
            url: "https://mcp.github.com",
            auth: { type: "bearer", token: "${GITHUB_TOKEN}" },
          },
        },
        envMap: { GITHUB_TOKEN: "ghp_abc123" },
      });

      const vars = getWrittenVars();
      const mcpConfig = JSON.parse(vars.KALP_MCP_CONFIG!);
      expect(mcpConfig.github.headers.authorization).toBe("Bearer ghp_abc123");
    });

    it("handles MCP servers with headers auth (resolves env markers)", async () => {
      mockExtractEnvName
        .mockReturnValueOnce("API_KEY")
        .mockReturnValueOnce(null);

      await injectRuntimeConfigs({
        wranglerConfigPath: "/tmp/wrangler.jsonc",
        aiRaw: undefined,
        identityConfig: baseIdentityConfig,
        mcpRaw: {
          service: {
            url: "https://api.service.com",
            auth: {
              type: "headers",
              headers: {
                "x-api-key": "${API_KEY}",
                "x-custom": "static-value",
              },
            },
          },
        },
        envMap: { API_KEY: "secret-123" },
      });

      const vars = getWrittenVars();
      const mcpConfig = JSON.parse(vars.KALP_MCP_CONFIG!);
      expect(mcpConfig.service.headers["x-api-key"]).toBe("secret-123");
      expect(mcpConfig.service.headers["x-custom"]).toBe("static-value");
    });

    it("handles MCP string shorthand servers", async () => {
      await injectRuntimeConfigs({
        wranglerConfigPath: "/tmp/wrangler.jsonc",
        aiRaw: undefined,
        identityConfig: baseIdentityConfig,
        mcpRaw: {
          memory: "https://memory.server.local",
          search: "https://search.server.local",
        },
        envMap: {},
      });

      const vars = getWrittenVars();
      const mcpConfig = JSON.parse(vars.KALP_MCP_CONFIG!);
      expect(mcpConfig.memory.url).toBe("https://memory.server.local");
      expect(mcpConfig.search.url).toBe("https://search.server.local");
      expect(mcpConfig.memory.headers).toBeUndefined();
    });

    it("handles missing MCP config gracefully", async () => {
      await injectRuntimeConfigs({
        wranglerConfigPath: "/tmp/wrangler.jsonc",
        aiRaw: undefined,
        identityConfig: baseIdentityConfig,
        mcpRaw: undefined,
        envMap: {},
      });

      const vars = getWrittenVars();
      expect(vars.KALP_MCP_CONFIG).toBeUndefined();
    });

    it("handles MCP config that is not an object", async () => {
      await injectRuntimeConfigs({
        wranglerConfigPath: "/tmp/wrangler.jsonc",
        aiRaw: undefined,
        identityConfig: baseIdentityConfig,
        mcpRaw: "not-an-object",
        envMap: {},
      });

      const vars = getWrittenVars();
      expect(vars.KALP_MCP_CONFIG).toBeUndefined();
    });

    it("skips MCP server entries without url", async () => {
      await injectRuntimeConfigs({
        wranglerConfigPath: "/tmp/wrangler.jsonc",
        aiRaw: undefined,
        identityConfig: baseIdentityConfig,
        mcpRaw: {
          emptyServer: { notUrl: "irrelevant" },
          validServer: { url: "https://valid.server" },
        },
        envMap: {},
      });

      const vars = getWrittenVars();
      const mcpConfig = JSON.parse(vars.KALP_MCP_CONFIG!);
      expect(Object.keys(mcpConfig)).toHaveLength(1);
      expect(mcpConfig.validServer.url).toBe("https://valid.server");
    });

    it("handles bearer auth with string token (resolves env markers)", async () => {
      mockExtractEnvName.mockReturnValue("BEARER_TOKEN");

      await injectRuntimeConfigs({
        wranglerConfigPath: "/tmp/wrangler.jsonc",
        aiRaw: undefined,
        identityConfig: baseIdentityConfig,
        mcpRaw: {
          service: {
            url: "https://api.service.com",
            auth: { type: "bearer", token: "${BEARER_TOKEN}" },
          },
        },
        envMap: { BEARER_TOKEN: "actual-bearer-token" },
      });

      const vars = getWrittenVars();
      const mcpConfig = JSON.parse(vars.KALP_MCP_CONFIG!);
      expect(mcpConfig.service.headers.authorization).toBe(
        "Bearer actual-bearer-token",
      );
    });

    it("handles auth as a plain string (deprecated format)", async () => {
      mockExtractEnvName.mockReturnValue("DEPRECATED_TOKEN");

      await injectRuntimeConfigs({
        wranglerConfigPath: "/tmp/wrangler.jsonc",
        aiRaw: undefined,
        identityConfig: baseIdentityConfig,
        mcpRaw: {
          legacyService: {
            url: "https://legacy.service",
            auth: "${DEPRECATED_TOKEN}",
          },
        },
        envMap: { DEPRECATED_TOKEN: "old-token-value" },
      });

      const vars = getWrittenVars();
      const mcpConfig = JSON.parse(vars.KALP_MCP_CONFIG!);
      expect(mcpConfig.legacyService.headers.authorization).toBe(
        "Bearer old-token-value",
      );
    });
  });

  describe("Preserves existing vars", () => {
    it("preserves existing vars like KALP_ENV", async () => {
      await injectRuntimeConfigs({
        wranglerConfigPath: "/tmp/wrangler.jsonc",
        aiRaw: { models: { t1: "gpt" } },
        identityConfig: baseIdentityConfig,
        mcpRaw: undefined,
        envMap: {},
      });

      const vars = getWrittenVars();
      expect(vars.KALP_ENV).toBe("production");
      expect(vars.KALP_AI_CONFIG).toBeDefined();
      expect(vars.KALP_IDENTITY_CONFIG).toBeDefined();
    });

    it("handles wrangler config without existing vars", async () => {
      mockReadFile.mockResolvedValue(
        JSON.stringify({ name: "no-vars-worker" }, null, 2) + "\n",
      );

      await injectRuntimeConfigs({
        wranglerConfigPath: "/tmp/wrangler.jsonc",
        aiRaw: { models: { t1: "gpt" } },
        identityConfig: baseIdentityConfig,
        mcpRaw: undefined,
        envMap: {},
      });

      const call = mockWriteFile.mock.calls[0];
      const written = JSON.parse(call[1] as string);
      expect(written.vars.KALP_AI_CONFIG).toBeDefined();
      expect(written.vars.KALP_IDENTITY_CONFIG).toBeDefined();
    });
  });

  describe("Writes to wrangler file correctly", () => {
    it("writes pretty-printed JSON with trailing newline", async () => {
      await injectRuntimeConfigs({
        wranglerConfigPath: "/tmp/wrangler.jsonc",
        aiRaw: { models: { t1: "gpt" } },
        identityConfig: baseIdentityConfig,
        mcpRaw: undefined,
        envMap: {},
      });

      expect(mockWriteFile).toHaveBeenCalledTimes(1);
      const call = mockWriteFile.mock.calls[0];
      expect(call[0]).toBe("/tmp/wrangler.jsonc");
      expect(typeof call[1]).toBe("string");
      expect((call[1] as string).endsWith("\n")).toBe(true);
    });

    it("writes all three config sections together", async () => {
      mockExtractEnvName.mockReturnValue("GH_TOKEN");

      await injectRuntimeConfigs({
        wranglerConfigPath: "/tmp/wrangler.jsonc",
        aiRaw: { models: { t1: "gpt" } },
        identityConfig: {
          enforceGlobalAuth: true,
          identityId: "id-xyz",
          strategy: {
            type: "apiKey",
            headerName: "x-key",
            envKey: "KEY",
          },
        },
        mcpRaw: {
          gh: {
            url: "https://mcp.gh",
            auth: { type: "bearer", token: "${GH_TOKEN}" },
          },
        },
        envMap: { GH_TOKEN: "tok" },
      });

      const vars = getWrittenVars();
      const aiConfig = JSON.parse(vars.KALP_AI_CONFIG!);
      const identityConfig = JSON.parse(vars.KALP_IDENTITY_CONFIG!);
      const mcpConfig = JSON.parse(vars.KALP_MCP_CONFIG!);

      expect(aiConfig.models).toEqual({ t1: "gpt" });
      expect(identityConfig.identityId).toBe("id-xyz");
      expect(mcpConfig.gh.url).toBe("https://mcp.gh");
      expect(mcpConfig.gh.headers.authorization).toBe("Bearer tok");
    });
  });
});
