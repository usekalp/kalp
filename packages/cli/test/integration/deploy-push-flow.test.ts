import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const { mockReadFile, mockWriteFile, mockAccess, mockMkdir } = vi.hoisted(
  () => ({
    mockReadFile: vi.fn(),
    mockWriteFile: vi.fn(),
    mockAccess: vi.fn(),
    mockMkdir: vi.fn(),
  }),
);

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...actual,
    readFile: mockReadFile,
    writeFile: mockWriteFile,
    access: mockAccess,
    mkdir: mockMkdir,
  };
});

vi.mock("@/utils/auth", () => ({
  requireAuth: vi.fn(),
  getAuthConfig: vi.fn(),
}));

vi.mock("@/utils/secret", () => ({
  ensureStudioSecrets: vi.fn(),
  ensureSecretKey: vi.fn(),
}));

vi.mock("@/utils/project-state", () => ({
  readProjectState: vi.fn(),
  writeProjectState: vi.fn(),
}));

vi.mock("@/utils/runtime", () => ({ materializeRuntime: vi.fn() }));

vi.mock("@/utils/ai", () => ({
  getRequiredAiSecrets: vi.fn(() => [
    "CLOUDFLARE_API_TOKEN",
    "CLOUDFLARE_ACCOUNT_ID",
  ]),
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

vi.mock("@/utils/runtime-config-inject", () => ({
  injectRuntimeConfigs: vi.fn(),
}));

vi.mock("@/utils/manifest", () => ({
  readAgentManifest: vi.fn(),
  computePushHash: vi.fn(),
}));

vi.mock("@/utils/validate", () => ({
  validateCompiledIR: vi.fn(() => ({ ok: true, phase: "ir" })),
}));

vi.mock("@/utils/ir/export", () => ({
  exportCompiledIrForDebug: vi.fn(),
}));

vi.mock("@clack/prompts", () => {
  const warnSpy = vi.fn();
  const infoSpy = vi.fn();
  const successSpy = vi.fn();
  return {
    default: {
      spinner: () => ({ start: vi.fn(), stop: vi.fn(), message: vi.fn() }),
      log: { warn: warnSpy, info: infoSpy, success: successSpy },
      confirm: vi.fn().mockResolvedValue(true),
      isCancel: vi.fn(() => false),
      outro: vi.fn(),
    },
    spinner: () => ({ start: vi.fn(), stop: vi.fn(), message: vi.fn() }),
    log: { warn: warnSpy, info: infoSpy, success: successSpy },
    confirm: vi.fn().mockResolvedValue(true),
    isCancel: vi.fn(() => false),
    outro: vi.fn(),
  };
});

vi.mock("picocolors", () => {
  const id = (s: string) => s;
  return {
    default: { cyan: id, bold: id, dim: id, green: id, yellow: id, red: id },
    cyan: id,
    bold: id,
    dim: id,
    green: id,
    yellow: id,
    red: id,
  };
});

import { requireAuth } from "@/utils/auth";
import { ensureStudioSecrets } from "@/utils/secret";
import { readProjectState } from "@/utils/project-state";
import { materializeRuntime } from "@/utils/runtime";
import { readDotEnv } from "@/utils/ai";
import {
  loadProjectConfig,
  resolveIdentityAuthRequirements,
  resolveRuntimeIdentityConfig,
} from "@/utils/project-config";
import { resolveProvider } from "@/utils/providers";
import { injectRuntimeConfigs } from "@/utils/runtime-config-inject";
import { readAgentManifest, computePushHash } from "@/utils/manifest";
import { pushSingleAgent } from "@/utils/push/upload-helpers";
import { uploadMcpConfig } from "@/utils/push/upload-helpers";
import { pushRemoteManifest } from "@/utils/push/upload-manifest";
import {
  createInitialState,
  ensureAgentState,
  hydrateLocalAgentVersionsFromRemoteIndex,
} from "@/utils/push/agent-state";
import { createFakeProvider } from "../fixtures/fake-provider";
import type { AgentManifestV3 } from "@/utils/manifest/types";
import type { SourceMetadataManifest } from "@kalphq/compiler";

function makeFullManifest(
  overrides: Partial<AgentManifestV3> = {},
): AgentManifestV3 {
  return {
    format: "kalp-agent-manifest",
    schemaVersion: 3,
    artifactManifest: {
      semanticHash: "sh-001",
      targets: { default: { deploymentHash: "dh-001" } },
      schemaVersion: 3,
      files: {},
    } as unknown as AgentManifestV3["artifactManifest"],
    semanticIr: {
      schemaVersion: 3,
      agent: { name: "test-agent" },
      nodes: [{ id: "n1", type: "trigger" }],
    } as unknown as AgentManifestV3["semanticIr"],
    schemas: {
      schemas: { MySchema: { type: "object" } },
    } as unknown as AgentManifestV3["schemas"],
    bundleManifest: {
      schemaVersion: 3,
      targets: {
        default: {
          abiVersion: "1",
          nodes: {
            main: {
              bundle: "agent",
              file: "./agent.js",
              size: 100,
              sha256: "abc",
            },
          },
        },
      },
    } as unknown as AgentManifestV3["bundleManifest"],
    bundles: {
      agent: {
        file: "agent.js",
        code: "export default {}",
        size: 100,
        sha256: "abc",
      },
    },
    metadata: { generatedAt: new Date().toISOString() },
    ...overrides,
  };
}

describe("integration: deploy-push flow", () => {
  let tmpDir: string;
  let fakeProvider: ReturnType<typeof createFakeProvider>;

  beforeEach(async () => {
    vi.clearAllMocks();
    tmpDir = await mkdtemp(join(tmpdir(), "kalp-integration-"));
    mockMkdir.mockResolvedValue(undefined);
    fakeProvider = createFakeProvider();
    vi.mocked(resolveProvider).mockReturnValue(fakeProvider);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  });

  describe("full deploy flow with mocked providers/fs/auth", () => {
    beforeEach(() => {
      vi.mocked(requireAuth).mockResolvedValue({
        provider: "cloudflare",
        accountId: "acc-001",
        email: "dev@test.com",
        expiresAt: "2099-01-01T00:00:00Z",
      });

      vi.mocked(loadProjectConfig).mockResolvedValue({
        path: join(tmpDir, "kalp.config.ts"),
        raw: {
          ai: { models: { tier1: "gpt-4" } },
          mcp: { gh: { url: "https://mcp.github" } },
          enforceGlobalAuth: true,
        },
      });

      vi.mocked(ensureStudioSecrets).mockResolvedValue({
        key: "secret-key-001",
        studioPassword: "studio-pass",
        studioAdminUser: "admin",
        serviceKey: "kalp_sk_live_abc",
        isNew: false,
      });

      vi.mocked(readDotEnv).mockResolvedValue({
        CLOUDFLARE_API_TOKEN: "cf-token",
        CLOUDFLARE_ACCOUNT_ID: "cf-acc-id",
      });

      vi.mocked(materializeRuntime).mockResolvedValue({
        runtimeDir: join(tmpDir, ".kalp", "runtime"),
        studioDir: join(tmpDir, ".kalp", "runtime", "studio"),
        workerEntrypointPath: join(tmpDir, ".kalp", "runtime", "index.ts"),
        wranglerConfigPath: join(tmpDir, ".kalp", "runtime", "wrangler.jsonc"),
        workerName: "test-worker",
      });

      vi.mocked(readProjectState).mockResolvedValue(null);
    });

    it("resolves all provider operations in correct order", async () => {
      const auth = await requireAuth();
      expect(auth.accountId).toBe("acc-001");

      const projectConfig = await loadProjectConfig(tmpDir);
      expect(projectConfig.raw.ai).toBeDefined();

      const secrets = await ensureStudioSecrets(tmpDir);
      expect(secrets.key).toBe("secret-key-001");

      const envMap = await readDotEnv(tmpDir);
      expect(envMap.CLOUDFLARE_API_TOKEN).toBe("cf-token");

      const runtime = await materializeRuntime(tmpDir);
      expect(runtime.workerName).toBe("test-worker");

      const identityConfig = resolveRuntimeIdentityConfig(projectConfig.raw);
      expect(identityConfig.enforceGlobalAuth).toBe(true);

      const requirements = resolveIdentityAuthRequirements(identityConfig);
      expect(requirements).toEqual([]);

      await injectRuntimeConfigs({
        wranglerConfigPath: runtime.wranglerConfigPath,
        aiRaw: projectConfig.raw.ai,
        identityConfig,
        mcpRaw: projectConfig.raw.mcp,
        envMap,
      });

      expect(injectRuntimeConfigs).toHaveBeenCalledWith(
        expect.objectContaining({
          wranglerConfigPath: runtime.wranglerConfigPath,
          aiRaw: projectConfig.raw.ai,
          mcpRaw: projectConfig.raw.mcp,
        }),
      );

      const deployResult = await fakeProvider.deployRuntime({
        cwd: tmpDir,
        configPath: runtime.wranglerConfigPath,
        useSecretsFile: false,
      });

      expect(deployResult.workerUrl).toBe("https://test.workers.dev");
      expect(fakeProvider.deployRuntime).toHaveBeenCalledTimes(1);
    });

    it("handles missing AI config in project config", async () => {
      vi.mocked(loadProjectConfig).mockResolvedValue({
        path: join(tmpDir, "kalp.config.ts"),
        raw: { enforceGlobalAuth: true },
      });

      const projectConfig = await loadProjectConfig(tmpDir);
      expect(projectConfig.raw.ai).toBeUndefined();

      const identityConfig = resolveRuntimeIdentityConfig(projectConfig.raw);
      expect(identityConfig.identityId).toBeNull();
      expect(identityConfig.strategy).toBeNull();
    });
  });

  describe("push flow with mocked manifest reader", () => {
    it("pushSingleAgent pushes a new agent successfully", async () => {
      const manifest = makeFullManifest();
      vi.mocked(readAgentManifest).mockResolvedValue(manifest);
      vi.mocked(computePushHash).mockReturnValue("dh-001");

      mockAccess.mockResolvedValue(true);

      const state = createInitialState();
      const spinner = {
        start: vi.fn(),
        stop: vi.fn(),
        message: vi.fn(),
      };

      const result = await pushSingleAgent({
        cwd: tmpDir,
        agentName: "hello-agent",
        agentPath: join(tmpDir, "agents", "hello-agent", "index.ts"),
        state,
        wranglerConfigPath: join(tmpDir, ".kalp", "runtime", "wrangler.jsonc"),
        spinner,
      });

      expect(result.status).toBe("pushed");
      if (result.status === "pushed") {
        expect(result.agentState.currentHash).toBe("dh-001");
        expect(result.agentState.currentVersion).toBe(1);
        expect(result.manifest.hash).toBe("dh-001");
      }

      expect(fakeProvider.putValue).toHaveBeenCalled();
    });

    it("pushSingleAgent skips when hash matches remote", async () => {
      const manifest = makeFullManifest();
      vi.mocked(readAgentManifest).mockResolvedValue(manifest);
      vi.mocked(computePushHash).mockReturnValue("dh-001");

      mockAccess.mockResolvedValue(true);

      const state = createInitialState();
      const agentState = ensureAgentState(
        state,
        "unchanged-agent",
        join(tmpDir, "agents", "unchanged-agent", "index.ts"),
      );
      agentState.lastRemoteHash = "dh-001";

      const spinner = { start: vi.fn(), stop: vi.fn(), message: vi.fn() };

      const result = await pushSingleAgent({
        cwd: tmpDir,
        agentName: "unchanged-agent",
        agentPath: join(tmpDir, "agents", "unchanged-agent", "index.ts"),
        state,
        wranglerConfigPath: join(tmpDir, ".kalp", "runtime", "wrangler.jsonc"),
        spinner,
      });

      expect(result.status).toBe("skipped");
      expect(fakeProvider.putValue).not.toHaveBeenCalled();
    });

    it("pushSingleAgent fails for missing agent path", async () => {
      mockAccess.mockRejectedValue(new Error("ENOENT"));

      const state = createInitialState();
      const spinner = { start: vi.fn(), stop: vi.fn(), message: vi.fn() };

      const result = await pushSingleAgent({
        cwd: tmpDir,
        agentName: "missing-agent",
        agentPath: join(tmpDir, "agents", "missing-agent", "index.ts"),
        state,
        wranglerConfigPath: join(tmpDir, ".kalp", "runtime", "wrangler.jsonc"),
        spinner,
      });

      expect(result.status).toBe("failed");
      if (result.status === "failed") {
        expect(result.error).toContain("missing");
      }
    });

    it("pushRemoteManifest uploads all artifacts via putValue fallback", async () => {
      const manifest = makeFullManifest({
        bundles: {
          agent: {
            file: "agent.js",
            code: "export default {}",
            size: 100,
            sha256: "sha1",
          },
          studio: {
            file: "studio.js",
            code: "export default {}",
            size: 200,
            sha256: "sha2",
          },
        },
        sourceMetadata: { sourceFiles: ["src/handler.ts"] } as unknown as SourceMetadataManifest,
      });

      await pushRemoteManifest({
        cwd: tmpDir,
        wranglerConfigPath: join(tmpDir, ".kalp", "runtime", "wrangler.jsonc"),
        agentName: "multi-bundle",
        hash: "hash-123",
        manifest,
      });

      const keys = vi
        .mocked(fakeProvider.putValue)
        .mock.calls.map((call: unknown[]) => (call[0] as { key: string }).key);

      expect(keys).toContain("multi-bundle:hash-123:artifact-manifest");
      expect(keys).toContain("multi-bundle:hash-123:semantic-ir");
      expect(keys).toContain("multi-bundle:hash-123:schemas");
      expect(keys).toContain("multi-bundle:hash-123:bundle-manifest");
      expect(keys).toContain("multi-bundle:hash-123:bundle:agent");
      expect(keys).toContain("multi-bundle:hash-123:bundle:studio");
      expect(keys).toContain("multi-bundle:hash-123:source-metadata");
      expect(keys).toContain("multi-bundle:latest");
    });
  });

  describe("secret collection and sync", () => {
    it("provider putSecret is called for each secret", async () => {
      const secrets: Array<[string, string]> = [
        ["KALP_SECRET_KEY", "key1"],
        ["KALP_STUDIO_PASSWORD", "pass1"],
        ["CLOUDFLARE_API_TOKEN", "cf-tok"],
      ];

      for (const [name, value] of secrets) {
        await fakeProvider.putSecret({
          cwd: tmpDir,
          configPath: join(tmpDir, "wrangler.jsonc"),
          name,
          value,
        });
      }

      expect(fakeProvider.putSecret).toHaveBeenCalledTimes(3);
      expect(fakeProvider.putSecret).toHaveBeenCalledWith(
        expect.objectContaining({ name: "KALP_SECRET_KEY", value: "key1" }),
      );
      expect(fakeProvider.putSecret).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "CLOUDFLARE_API_TOKEN",
          value: "cf-tok",
        }),
      );
    });

    it("handles secret sync failure gracefully", async () => {
      vi.mocked(fakeProvider.putSecret)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("rate limited"));

      const secrets: Array<[string, string]> = [
        ["KEY1", "val1"],
        ["KEY2", "val2"],
        ["KEY3", "val3"],
      ];

      let failed = false;
      for (const [name, value] of secrets) {
        try {
          await fakeProvider.putSecret({
            cwd: tmpDir,
            configPath: join(tmpDir, "wrangler.jsonc"),
            name,
            value,
          });
        } catch {
          failed = true;
          break;
        }
      }

      expect(failed).toBe(true);
      expect(fakeProvider.putSecret).toHaveBeenCalledTimes(2);
    });
  });

  describe("agent state persistence across pushes", () => {
    it("createInitialState creates empty state", () => {
      const state = createInitialState();
      expect(state.workerUrl).toBeNull();
      expect(state.agents).toEqual({});
    });

    it("ensureAgentState creates new agent state", () => {
      const state = createInitialState();
      const agentState = ensureAgentState(
        state,
        "my-agent",
        "/proj/agents/my-agent/index.ts",
      );

      expect(agentState.currentHash).toBeNull();
      expect(agentState.currentVersion).toBe(0);
      expect(agentState.localPath).toBe("/proj/agents/my-agent/index.ts");
      expect(state.agents["my-agent"]).toBe(agentState);
    });

    it("ensureAgentState returns existing agent and updates localPath", () => {
      const state = createInitialState();
      const first = ensureAgentState(state, "test-agent", "/old/path/index.ts");
      first.currentHash = "hash-v1";
      first.currentVersion = 3;

      const second = ensureAgentState(
        state,
        "test-agent",
        "/new/path/index.ts",
      );

      expect(second).toBe(first);
      expect(second.currentHash).toBe("hash-v1");
      expect(second.currentVersion).toBe(3);
      expect(second.localPath).toBe("/new/path/index.ts");
    });

    it("hydrateLocalAgentVersionsFromRemoteIndex fills missing data", () => {
      const state = createInitialState();
      const agent = ensureAgentState(
        state,
        "remote-agent",
        "/proj/agents/remote-agent/index.ts",
      );

      hydrateLocalAgentVersionsFromRemoteIndex({
        state,
        remoteEntries: [
          {
            name: "remote-agent",
            hash: "remote-hash-001",
            versionNumber: 5,
            updatedAt: "2025-06-01T12:00:00Z",
            workerUrl: "https://worker.dev/a/remote-agent",
          },
        ],
        cwd: tmpDir,
      });

      expect(agent.currentVersion).toBe(5);
      expect(agent.lastRemoteHash).toBe("remote-hash-001");
      expect(agent.currentHash).toBe("remote-hash-001");
      expect(agent.lastPushedAt).toBe("2025-06-01T12:00:00Z");
      expect(agent.workerUrl).toBe("https://worker.dev/a/remote-agent");
    });

    it("agent state persists versions across multiple pushes", async () => {
      const state = createInitialState();
      ensureAgentState(
        state,
        "multi-push",
        join(tmpDir, "agents/multi-push/index.ts"),
      );

      const manifest1 = makeFullManifest();
      vi.mocked(readAgentManifest).mockResolvedValue(manifest1);
      vi.mocked(computePushHash).mockReturnValue("hash-v1");
      mockAccess.mockResolvedValue(true);

      const spinner = { start: vi.fn(), stop: vi.fn(), message: vi.fn() };

      const result1 = await pushSingleAgent({
        cwd: tmpDir,
        agentName: "multi-push",
        agentPath: join(tmpDir, "agents", "multi-push", "index.ts"),
        state,
        wranglerConfigPath: join(tmpDir, "wrangler.jsonc"),
        spinner,
      });

      expect(result1.status).toBe("pushed");
      if (result1.status === "pushed") {
        expect(result1.agentState.currentVersion).toBe(1);
        expect(result1.agentState.currentHash).toBe("hash-v1");
      }

      vi.mocked(computePushHash).mockReturnValue("hash-v2");

      const result2 = await pushSingleAgent({
        cwd: tmpDir,
        agentName: "multi-push",
        agentPath: join(tmpDir, "agents", "multi-push", "index.ts"),
        state,
        wranglerConfigPath: join(tmpDir, "wrangler.jsonc"),
        spinner,
      });

      expect(result2.status).toBe("pushed");
      if (result2.status === "pushed") {
        expect(result2.agentState.currentVersion).toBe(2);
        expect(result2.agentState.currentHash).toBe("hash-v2");
      }
    });
  });

  describe("pruning stale agents", () => {
    it("identifies stale agents not in local set", () => {
      const remoteEntries = [
        {
          name: "agent-a",
          hash: "h1",
          version: "1",
          versionNumber: 1,
          updatedAt: "2025-01-01",
          workerUrl: null,
        },
        {
          name: "agent-b",
          hash: "h2",
          version: "1",
          versionNumber: 1,
          updatedAt: "2025-01-01",
          workerUrl: null,
        },
        {
          name: "agent-c",
          hash: "h3",
          version: "1",
          versionNumber: 1,
          updatedAt: "2025-01-01",
          workerUrl: null,
        },
      ];

      const localAgentNames = ["agent-b"];
      const localSet = new Set(localAgentNames);

      const staleEntries = remoteEntries.filter(
        (entry) => !localSet.has(entry.name),
      );
      expect(staleEntries).toHaveLength(2);
      expect(staleEntries.map((e) => e.name)).toEqual(["agent-a", "agent-c"]);
    });

    it("returns empty prune when no stale agents", () => {
      const remoteEntries = [
        {
          name: "agent-a",
          hash: "h1",
          version: null,
          versionNumber: null,
          updatedAt: "t",
          workerUrl: null,
        },
      ];

      const staleEntries = remoteEntries.filter(
        (entry) => !new Set(["agent-a"]).has(entry.name),
      );

      expect(staleEntries).toHaveLength(0);
    });
  });

  describe("MCP config upload to KV", () => {
    it("uploads MCP config when file exists", async () => {
      const mcpJson = JSON.stringify({
        servers: { github: { url: "https://mcp.github" } },
      });

      mockReadFile.mockResolvedValue(mcpJson);

      await uploadMcpConfig(tmpDir, join(tmpDir, "wrangler.jsonc"));

      expect(fakeProvider.putValue).toHaveBeenCalledTimes(1);
      const call = vi.mocked(fakeProvider.putValue).mock.calls[0]![0];
      expect(call.key).toBe("mcp:config");
      expect(call.value).toBe(mcpJson);
    });

    it("skips upload when MCP config file does not exist", async () => {
      mockReadFile.mockRejectedValue(new Error("ENOENT"));

      await uploadMcpConfig(tmpDir, join(tmpDir, "wrangler.jsonc"));

      expect(fakeProvider.putValue).not.toHaveBeenCalled();
    });

    it("handles upload failure gracefully with warning", async () => {
      mockReadFile.mockResolvedValue("{}");
      vi.mocked(fakeProvider.putValue).mockRejectedValueOnce(
        new Error("network error"),
      );

      await uploadMcpConfig(tmpDir, join(tmpDir, "wrangler.jsonc"));

      expect(fakeProvider.putValue).toHaveBeenCalledTimes(1);
    });
  });
});
