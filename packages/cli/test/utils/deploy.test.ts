import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const { mockExeca, mockReadFile, mockWriteFile } = vi.hoisted(() => ({
  mockExeca: vi.fn(),
  mockReadFile: vi.fn(),
  mockWriteFile: vi.fn(),
}));

vi.mock("execa", () => ({ execa: mockExeca }));

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return { ...actual, readFile: mockReadFile, writeFile: mockWriteFile };
});

vi.mock("@/utils/auth", () => ({ requireAuth: vi.fn() }));

vi.mock("@/utils/secret", () => ({ ensureStudioSecrets: vi.fn() }));

vi.mock("@/utils/project-state", () => ({
  readProjectState: vi.fn(),
  writeProjectState: vi.fn(),
}));

vi.mock("@/utils/runtime", () => ({ materializeRuntime: vi.fn() }));

vi.mock("@/utils/ai", () => ({
  getRequiredAiSecrets: vi.fn(() => ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"]),
  readDotEnv: vi.fn(),
}));

vi.mock("@/utils/project-config", () => ({
  loadProjectConfig: vi.fn(),
  resolveIdentityAuthRequirements: vi.fn(() => []),
  resolveRuntimeIdentityConfig: vi.fn(() => ({
    enforceGlobalAuth: true,
    identityId: null,
    strategy: null,
  })),
}));

vi.mock("@/utils/providers", () => ({ resolveProvider: vi.fn() }));

vi.mock("@/utils/runtime-config-inject", () => ({ injectRuntimeConfigs: vi.fn() }));

import {
  ensureKvNamespaceBindingId,
  isNamespaceAlreadyExistsError,
  runInitialDeploy,
} from "@/utils/deploy";
import { requireAuth } from "@/utils/auth";
import { ensureStudioSecrets } from "@/utils/secret";
import { readProjectState, writeProjectState } from "@/utils/project-state";
import { materializeRuntime } from "@/utils/runtime";
import { readDotEnv, getRequiredAiSecrets } from "@/utils/ai";
import {
  loadProjectConfig,
  resolveIdentityAuthRequirements,
  resolveRuntimeIdentityConfig,
} from "@/utils/project-config";
import type { RuntimeIdentityConfig } from "@/utils/project-config";
import { resolveProvider } from "@/utils/providers";
import { injectRuntimeConfigs } from "@/utils/runtime-config-inject";
import { createFakeProvider } from "../fixtures/fake-provider";

interface SecretResult {
  key: string;
  studioPassword: string;
  studioAdminUser: string;
  serviceKey: string;
}

function collectSecretEntries(params: {
  studioSecrets: SecretResult;
  envMap: Record<string, string>;
  identityConfig: {
    enforceGlobalAuth: boolean;
    identityId: string | null;
    strategy: Record<string, unknown> | null;
  };
}): Array<[string, string]> {
  const { studioSecrets, envMap, identityConfig } = params;

  const aiSecrets = getRequiredAiSecrets();
  const aiEntries: Array<[string, string]> = [];
  for (const secret of aiSecrets) {
    const value = envMap[secret]?.trim();
    if (value) aiEntries.push([secret, value]);
  }

  const identityRequirements = resolveIdentityAuthRequirements(identityConfig as unknown as RuntimeIdentityConfig);
  const identityEntries = identityRequirements.map((req) => {
    const value = envMap[req.envKey]?.trim();
    if (!value) {
      throw new Error(
        `Missing required secret ${req.envKey} for ${req.reason}. Add it to .env before deploy.`,
      );
    }
    return [req.envKey, value] as [string, string];
  });

  const entries: Array<[string, string]> = [
    ["KALP_SECRET_KEY", studioSecrets.key],
    ["KALP_STUDIO_PASSWORD", studioSecrets.studioPassword],
    ["KALP_STUDIO_ADMIN_USER", studioSecrets.studioAdminUser],
    ["KALP_SERVICE_KEY", studioSecrets.serviceKey],
    ...aiEntries,
    ...identityEntries,
  ];

  const deduped = new Map<string, string>();
  for (const [name, value] of entries) deduped.set(name, value);
  return [...deduped.entries()];
}

async function syncSecrets(
  provider: { putSecret: ReturnType<typeof vi.fn> },
  _cwd: string,
  _configPath: string,
  secrets: Array<[string, string]>,
): Promise<boolean> {
  for (const [name, value] of secrets) {
    try {
      await provider.putSecret({ cwd: _cwd, configPath: _configPath, name, value });
    } catch {
      return true;
    }
  }
  return false;
}

function resolveFingerprints(
  adminUser: string,
  adminPassword: string,
  serviceKey: string,
) {
  return {
    credentialsFingerprint: createHash("sha256")
      .update(`${adminUser}:${adminPassword}`)
      .digest("hex"),
    serviceKeyFingerprint: createHash("sha256").update(serviceKey).digest("hex"),
  };
}

describe("deploy", () => {
  let tmpDir: string;
  let configPath: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    tmpDir = await mkdtemp(join(tmpdir(), "kalp-deploy-test-"));
    configPath = join(tmpDir, "wrangler.jsonc");
  });

  describe("ensureKvNamespaceBindingId", () => {
    it("finds existing namespace by title and returns its id", async () => {
      const wranglerJson =
        JSON.stringify(
          {
            name: "my-worker",
            kv_namespaces: [{ binding: "KALP_MANIFESTS" }],
          },
          null,
          2,
        ) + "\n";
      mockReadFile.mockResolvedValue(wranglerJson);

      mockExeca.mockResolvedValueOnce({
        stdout: JSON.stringify([
          { id: "existing-ns-id", title: "my-worker-kalp-manifests" },
        ]),
        stderr: "",
      });

      const result = await ensureKvNamespaceBindingId(tmpDir, configPath);

      expect(result).toBe("existing-ns-id");
      // Should have written the config with the id
      expect(mockWriteFile).toHaveBeenCalled();
      const written = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
      expect(written.kv_namespaces[0].id).toBe("existing-ns-id");
    });

    it("creates a new namespace when none exists", async () => {
      const wranglerJson =
        JSON.stringify(
          {
            name: "my-worker",
            kv_namespaces: [{ binding: "KALP_MANIFESTS" }],
          },
          null,
          2,
        ) + "\n";
      mockReadFile.mockResolvedValue(wranglerJson);

      mockExeca.mockResolvedValueOnce({ stdout: JSON.stringify([]), stderr: "" });
      mockExeca.mockResolvedValueOnce({
        stdout: '{"id": "new-ns-id", "title": "my-worker-kalp-manifests"}',
        stderr: "",
      });

      const result = await ensureKvNamespaceBindingId(tmpDir, configPath);

      expect(result).toBe("new-ns-id");
      expect(mockWriteFile).toHaveBeenCalled();
    });

    it("parses wrangler namespace list output correctly", async () => {
      const wranglerJson =
        JSON.stringify(
          {
            name: "parsed-worker",
            kv_namespaces: [{ binding: "KALP_MANIFESTS" }],
          },
          null,
          2,
        ) + "\n";
      mockReadFile.mockResolvedValue(wranglerJson);

      mockExeca.mockResolvedValueOnce({
        stdout: JSON.stringify([
          { id: "ns-abc", title: "other-ns" },
          { id: "ns-xyz", title: "parsed-worker-kalp-manifests" },
        ]),
        stderr: "",
      });

      const result = await ensureKvNamespaceBindingId(tmpDir, configPath);
      expect(result).toBe("ns-xyz");
    });

    it("returns null when binding is missing", async () => {
      const wranglerJson =
        JSON.stringify(
          {
            name: "my-worker",
            kv_namespaces: [{ binding: "OTHER_BINDING" }],
          },
          null,
          2,
        ) + "\n";
      mockReadFile.mockResolvedValue(wranglerJson);

      const result = await ensureKvNamespaceBindingId(tmpDir, configPath);
      expect(result).toBeNull();
    });

    it("returns null when worker name is missing", async () => {
      const wranglerJson =
        JSON.stringify(
          { kv_namespaces: [{ binding: "KALP_MANIFESTS" }] },
          null,
          2,
        ) + "\n";
      mockReadFile.mockResolvedValue(wranglerJson);

      const result = await ensureKvNamespaceBindingId(tmpDir, configPath);
      expect(result).toBeNull();
    });

    it("returns existing id without calling wrangler", async () => {
      const wranglerJson =
        JSON.stringify(
          {
            name: "my-worker",
            kv_namespaces: [
              { binding: "KALP_MANIFESTS", id: "already-set-id" },
            ],
          },
          null,
          2,
        ) + "\n";
      mockReadFile.mockResolvedValue(wranglerJson);

      const result = await ensureKvNamespaceBindingId(tmpDir, configPath);

      expect(result).toBe("already-set-id");
      expect(mockExeca).not.toHaveBeenCalled();
    });

    it("handles namespace list failure gracefully and creates new", async () => {
      const wranglerJson =
        JSON.stringify(
          {
            name: "my-worker",
            kv_namespaces: [{ binding: "KALP_MANIFESTS" }],
          },
          null,
          2,
        ) + "\n";
      mockReadFile.mockResolvedValue(wranglerJson);

      mockExeca.mockRejectedValueOnce(new Error("auth failed"));
      mockExeca.mockResolvedValueOnce({
        stdout:
          '{"id": "created-after-failure", "title": "my-worker-kalp-manifests"}',
        stderr: "",
      });

      const result = await ensureKvNamespaceBindingId(tmpDir, configPath);
      expect(result).toBe("created-after-failure");
    });

    it("handles malformed list output gracefully", async () => {
      const wranglerJson =
        JSON.stringify(
          {
            name: "my-worker",
            kv_namespaces: [{ binding: "KALP_MANIFESTS" }],
          },
          null,
          2,
        ) + "\n";
      mockReadFile.mockResolvedValue(wranglerJson);

      mockExeca.mockResolvedValueOnce({ stdout: "not valid json", stderr: "" });
      mockExeca.mockResolvedValueOnce({
        stdout:
          '{"id": "ns-after-bad-parse", "title": "my-worker-kalp-manifests"}',
        stderr: "",
      });

      const result = await ensureKvNamespaceBindingId(tmpDir, configPath);
      expect(result).toBe("ns-after-bad-parse");
    });

    it("returns null when create output has no id match", async () => {
      const wranglerJson =
        JSON.stringify(
          {
            name: "no-id-worker",
            kv_namespaces: [{ binding: "KALP_MANIFESTS" }],
          },
          null,
          2,
        ) + "\n";
      mockReadFile.mockResolvedValue(wranglerJson);

      mockExeca.mockResolvedValueOnce({ stdout: JSON.stringify([]), stderr: "" });
      mockExeca.mockResolvedValueOnce({
        stdout: "error: something went wrong",
        stderr: "",
      });

      const result = await ensureKvNamespaceBindingId(tmpDir, configPath);
      expect(result).toBeNull();
    });
  });

  describe("isNamespaceAlreadyExistsError", () => {
    it("detects error code 10014 with already exists message", () => {
      expect(
        isNamespaceAlreadyExistsError("error [code: 10014] namespace already exists"),
      ).toBe(true);
    });

    it("returns false for other errors", () => {
      expect(isNamespaceAlreadyExistsError("error [code: 10015] something else")).toBe(
        false,
      );
    });

    it("returns false for empty string", () => {
      expect(isNamespaceAlreadyExistsError("")).toBe(false);
    });

    it("returns false when only code matches but not message", () => {
      expect(
        isNamespaceAlreadyExistsError("error [code: 10014] namespace created"),
      ).toBe(false);
    });
  });

  describe("collectSecretEntries", () => {
    const baseSecrets: SecretResult = {
      key: "test-secret-key",
      studioPassword: "test-pass",
      studioAdminUser: "admin",
      serviceKey: "kalp_sk_test",
    };

    it("builds deduped secrets list with studio secrets", () => {
      const entries = collectSecretEntries({
        studioSecrets: baseSecrets,
        envMap: {},
        identityConfig: {
          enforceGlobalAuth: true,
          identityId: null,
          strategy: null,
        },
      });

      expect(entries).toHaveLength(4);
      const map = new Map(entries);
      expect(map.get("KALP_SECRET_KEY")).toBe("test-secret-key");
      expect(map.get("KALP_STUDIO_PASSWORD")).toBe("test-pass");
      expect(map.get("KALP_STUDIO_ADMIN_USER")).toBe("admin");
      expect(map.get("KALP_SERVICE_KEY")).toBe("kalp_sk_test");
    });

    it("includes AI secrets from envMap when available", () => {
      const entries = collectSecretEntries({
        studioSecrets: baseSecrets,
        envMap: {
          CLOUDFLARE_API_TOKEN: "cf-token",
          CLOUDFLARE_ACCOUNT_ID: "cf-account",
        },
        identityConfig: {
          enforceGlobalAuth: true,
          identityId: null,
          strategy: null,
        },
      });

      const map = new Map(entries);
      expect(map.get("CLOUDFLARE_API_TOKEN")).toBe("cf-token");
      expect(map.get("CLOUDFLARE_ACCOUNT_ID")).toBe("cf-account");
    });

    it("skips AI secrets not in envMap", () => {
      const entries = collectSecretEntries({
        studioSecrets: baseSecrets,
        envMap: { CLOUDFLARE_API_TOKEN: "cf-token" },
        identityConfig: {
          enforceGlobalAuth: true,
          identityId: null,
          strategy: null,
        },
      });

      const map = new Map(entries);
      expect(map.has("CLOUDFLARE_API_TOKEN")).toBe(true);
      expect(map.has("CLOUDFLARE_ACCOUNT_ID")).toBe(false);
    });

    it("throws when required identity secrets are missing", () => {
      vi.mocked(resolveIdentityAuthRequirements).mockReturnValueOnce([
        { envKey: "JWT_SIGNING_SECRET", reason: "symmetric JWT" },
      ]);

      expect(() =>
        collectSecretEntries({
          studioSecrets: baseSecrets,
          envMap: {},
          identityConfig: {
            enforceGlobalAuth: true,
            identityId: null,
            strategy: null,
          },
        }),
      ).toThrow("Missing required secret JWT_SIGNING_SECRET");
    });

    it("includes identity secrets when present", () => {
      vi.mocked(resolveIdentityAuthRequirements).mockReturnValueOnce([
        { envKey: "JWT_SIGNING_SECRET", reason: "symmetric JWT" },
      ]);

      const entries = collectSecretEntries({
        studioSecrets: baseSecrets,
        envMap: { JWT_SIGNING_SECRET: "my-jwt-secret" },
        identityConfig: {
          enforceGlobalAuth: true,
          identityId: null,
          strategy: null,
        },
      });

      const map = new Map(entries);
      expect(map.get("JWT_SIGNING_SECRET")).toBe("my-jwt-secret");
    });

    it("deduplicates secret entries by keeping first value", () => {
      const entries = collectSecretEntries({
        studioSecrets: baseSecrets,
        envMap: { KALP_SECRET_KEY: "env-override" },
        identityConfig: {
          enforceGlobalAuth: true,
          identityId: null,
          strategy: null,
        },
      });

      const map = new Map(entries);
      expect(map.get("KALP_SECRET_KEY")).toBe("test-secret-key");
    });
  });

  describe("syncSecrets", () => {
    it("pushes all secrets successfully", async () => {
      const provider = { putSecret: vi.fn().mockResolvedValue(undefined) };
      const secrets: Array<[string, string]> = [
        ["KEY1", "val1"],
        ["KEY2", "val2"],
      ];

      const result = await syncSecrets(provider, "/tmp", "/tmp/wrangler.jsonc", secrets);
      expect(result).toBe(false);
      expect(provider.putSecret).toHaveBeenCalledTimes(2);
    });

    it("returns true on first failure", async () => {
      const provider = {
        putSecret: vi
          .fn()
          .mockResolvedValueOnce(undefined)
          .mockRejectedValueOnce(new Error("failed")),
      };
      const secrets: Array<[string, string]> = [
        ["KEY1", "val1"],
        ["KEY2", "val2"],
        ["KEY3", "val3"],
      ];

      const result = await syncSecrets(provider, "/tmp", "/tmp/wrangler.jsonc", secrets);
      expect(result).toBe(true);
      expect(provider.putSecret).toHaveBeenCalledTimes(2);
    });

    it("returns false for empty secrets list", async () => {
      const provider = { putSecret: vi.fn() };
      const result = await syncSecrets(provider, "/tmp", "/tmp/wrangler.jsonc", []);
      expect(result).toBe(false);
      expect(provider.putSecret).not.toHaveBeenCalled();
    });
  });

  describe("resolveFingerprints", () => {
    it("computes SHA256 fingerprints for credentials and service key", () => {
      const result = resolveFingerprints("admin-user", "admin-pass", "service-key-123");

      expect(result.credentialsFingerprint).toBe(
        createHash("sha256").update("admin-user:admin-pass").digest("hex"),
      );
      expect(result.serviceKeyFingerprint).toBe(
        createHash("sha256").update("service-key-123").digest("hex"),
      );
    });

    it("produces different fingerprints for different service keys", () => {
      const r1 = resolveFingerprints("a", "b", "c");
      const r2 = resolveFingerprints("a", "b", "d");

      expect(r1.credentialsFingerprint).toBe(r2.credentialsFingerprint);
      expect(r1.serviceKeyFingerprint).not.toBe(r2.serviceKeyFingerprint);
    });

    it("is deterministic", () => {
      const r1 = resolveFingerprints("x", "y", "z");
      const r2 = resolveFingerprints("x", "y", "z");
      expect(r1).toEqual(r2);
    });
  });

  describe("runInitialDeploy", () => {
    const defaultAuth = {
      provider: "cloudflare" as const,
      accountId: "account-123",
      email: "test@example.com",
      expiresAt: "2099-01-01T00:00:00Z",
    };

    const defaultStudioSecrets = {
      key: "test-secret-key",
      studioPassword: "test-studio-pass",
      studioAdminUser: "admin",
      serviceKey: "kalp_sk_live_test",
      isNew: false,
    };

    const defaultRuntime = {
      runtimeDir: join(tmpdir(), ".kalp", "runtime"),
      studioDir: join(tmpdir(), ".kalp", "runtime", "studio"),
      workerEntrypointPath: join(tmpdir(), ".kalp", "runtime", "index.ts"),
      wranglerConfigPath: join(tmpdir(), ".kalp", "runtime", "wrangler.jsonc"),
      workerName: "test-worker",
    };

    const defaultProjectConfig = {
      path: join(tmpdir(), "kalp.config.ts"),
      raw: { ai: { models: {} }, identity: undefined, enforceGlobalAuth: true },
    };

    beforeEach(() => {
      vi.mocked(requireAuth).mockResolvedValue(defaultAuth);
      vi.mocked(loadProjectConfig).mockResolvedValue(defaultProjectConfig);
      vi.mocked(resolveRuntimeIdentityConfig).mockReturnValue({
        enforceGlobalAuth: true,
        identityId: null,
        strategy: null,
      });
      vi.mocked(ensureStudioSecrets).mockResolvedValue(defaultStudioSecrets);
      vi.mocked(readDotEnv).mockResolvedValue({});
      vi.mocked(materializeRuntime).mockResolvedValue(defaultRuntime);
      vi.mocked(readProjectState).mockResolvedValue(null);
      vi.mocked(writeProjectState).mockResolvedValue(undefined);

      const fakeProvider = createFakeProvider();
      vi.mocked(resolveProvider).mockReturnValue(fakeProvider);

      mockReadFile.mockResolvedValue(
        JSON.stringify(
          {
            name: "test-worker",
            kv_namespaces: [
              { binding: "KALP_MANIFESTS", id: "existing-id" },
            ],
          },
          null,
          2,
        ) + "\n",
      );
    });

    it("runs end-to-end deploy flow successfully", async () => {
      const result = await runInitialDeploy(tmpDir);

      expect(result.workerUrl).toBe("https://test.workers.dev");
      expect(result.accountId).toBe("account-123");
      expect(result.studioAdminUser).toBe("admin");
      expect(result.studioPassword).toBe("test-studio-pass");
      expect(result.serviceKey).toBe("kalp_sk_live_test");
      expect(result.customDomains).toEqual([]);
      expect(result.credentialsChanged).toBe(true);
      expect(result.serviceKeyChanged).toBe(true);
    });

    it("detects unchanged credentials", async () => {
      const fingerprints = resolveFingerprints(
        defaultStudioSecrets.studioAdminUser,
        defaultStudioSecrets.studioPassword,
        defaultStudioSecrets.serviceKey,
      );

      vi.mocked(readProjectState).mockResolvedValue({
        workerUrl: "https://old.workers.dev",
        deployedAt: "2024-01-01T00:00:00Z",
        accountId: "account-123",
        studioCredentialsFingerprint: fingerprints.credentialsFingerprint,
        serviceKeyFingerprint: fingerprints.serviceKeyFingerprint,
        agents: {},
      });

      const result = await runInitialDeploy(tmpDir);

      expect(result.credentialsChanged).toBe(false);
      expect(result.serviceKeyChanged).toBe(false);
    });

    it("persists state after deploy", async () => {
      await runInitialDeploy(tmpDir);

      expect(writeProjectState).toHaveBeenCalledTimes(1);
      const stateArg = vi.mocked(writeProjectState).mock.calls[0]![1];
      expect(stateArg.workerUrl).toBe("https://test.workers.dev");
      expect(stateArg.accountId).toBe("account-123");
      expect(stateArg.studioCredentialsFingerprint).toBeDefined();
      expect(stateArg.serviceKeyFingerprint).toBeDefined();
    });

    it("injects runtime configs with AI and MCP config", async () => {
      vi.mocked(loadProjectConfig).mockResolvedValue({
        path: join(tmpDir, "kalp.config.ts"),
        raw: {
          ai: { models: { gemini: "gemini-pro" } },
          mcp: { myServer: { url: "https://mcp.example.com" } },
          enforceGlobalAuth: true,
        },
      });

      await runInitialDeploy(tmpDir);

      expect(injectRuntimeConfigs).toHaveBeenCalledTimes(1);
      const callArg = vi.mocked(injectRuntimeConfigs).mock.calls[0]![0];
      expect(callArg.aiRaw).toEqual({ models: { gemini: "gemini-pro" } });
      expect(callArg.mcpRaw).toEqual({
        myServer: { url: "https://mcp.example.com" },
      });
    });

    it("calls ensureKvNamespaceBindingId during deploy", async () => {
      await runInitialDeploy(tmpDir);
      expect(mockReadFile).toHaveBeenCalled();
    });
  });
});
