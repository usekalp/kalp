import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PushOutcome } from "@/utils/push/upload-helpers";
import type { AgentManifestV3 } from "@/utils/manifest/types";

const { providerMock, mockLogWarn, mockSpinnerConstructor } = vi.hoisted(() => ({
  providerMock: {
    putValue: vi.fn().mockResolvedValue(undefined),
  },
  mockLogWarn: vi.fn(),
  mockSpinnerConstructor: vi.fn(),
}));

vi.mock("@/utils/providers", () => ({
  resolveProvider: () => providerMock,
}));

vi.mock("@kalphq/compiler", () => ({
  buildAgent: vi.fn(),
  analyzeHandler: vi.fn(),
  calculateArtifactHash: vi.fn(),
  calculateDeploymentHash: vi.fn(),
  calculateSemanticHash: vi.fn(),
  validateIR: vi.fn(),
  validateIRBindings: vi.fn(),
}));

vi.mock("@kalphq/sdk", () => ({
  extractEnvName: vi.fn(),
  normalizeMcpServer: vi.fn(),
}));

vi.mock("@/utils/manifest", async () => {
  return {
    readAgentManifest: vi.fn(),
    computePushHash: vi.fn(),
  };
});

vi.mock("@/utils/validate", () => ({
  validateCompiledIR: vi.fn(),
}));

vi.mock("@/utils/ir/export", () => ({
  exportCompiledIrForDebug: vi.fn(),
}));

vi.mock("@/utils/push/upload-manifest", () => ({
  pushRemoteManifest: vi.fn(),
}));

vi.mock("node:fs/promises", async () => {
  const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  return {
    ...actual,
    readFile: vi.fn(),
    access: vi.fn(),
  };
});

vi.mock("@clack/prompts", () => ({
  log: { warn: mockLogWarn },
  spinner: mockSpinnerConstructor,
}));

import { uploadMcpConfig, pushSingleAgent } from "@/utils/push/upload-helpers";
import { readFile, access } from "node:fs/promises";
import { readAgentManifest, computePushHash } from "@/utils/manifest";
import { validateCompiledIR } from "@/utils/validate";
import { pushRemoteManifest } from "@/utils/push/upload-manifest";
import { exportCompiledIrForDebug } from "@/utils/ir/export";
import { createInitialState } from "@/utils/push/agent-state";

const CWD = "/test/project";
const WRANGLER_PATH = "/test/wrangler.toml";
const AGENT_NAME = "test-agent";
const AGENT_PATH = "/test/project/agents/test-agent/index.ts";

function makeFakeSpinner() {
  return {
    start: vi.fn(),
    stop: vi.fn(),
    message: vi.fn(),
  };
}

function makeManifest(): AgentManifestV3 {
  return {
    format: "kalp-agent-manifest",
    schemaVersion: 3,
    artifactManifest: {
      schemaVersion: 3 as const,
      semanticHash: "",
      files: { semanticIr: "", schemas: "", bundleManifest: "" },
      targets: {},
    },
    semanticIr: {
      schemaVersion: 3 as const,
      agent: { name: "" },
      nodes: {},
    },
    schemas: {},
    bundleManifest: {
      schemaVersion: 3 as const,
      targets: { default: { abiVersion: 1, nodes: {} } },
    },
    bundles: {
      main: { file: "handler.ts", code: "export default {}", size: 50, sha256: "sha" },
    },
    metadata: {},
  };
}

function makeInitialState() {
  return {
    workerUrl: "https://worker.dev",
    deployedAt: null,
    accountId: null,
    studioCredentialsFingerprint: null,
    serviceKeyFingerprint: null,
    agents: {} as Record<string, any>,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("uploadMcpConfig", () => {
  it("reads mcp-config.json and pushes to KV", async () => {
    vi.mocked(readFile).mockResolvedValueOnce('{"mcpServers":{}}');

    await uploadMcpConfig(CWD, WRANGLER_PATH);

    expect(readFile).toHaveBeenCalledWith(
      expect.stringContaining(".kalp"),
      "utf-8",
    );
    expect(providerMock.putValue).toHaveBeenCalledWith({
      cwd: CWD,
      configPath: WRANGLER_PATH,
      key: "mcp:config",
      value: '{"mcpServers":{}}',
    });
  });

  it("returns early when mcp-config.json is missing", async () => {
    vi.mocked(readFile).mockRejectedValueOnce(new Error("ENOENT"));

    await uploadMcpConfig(CWD, WRANGLER_PATH);

    expect(providerMock.putValue).not.toHaveBeenCalled();
  });

  it("returns early when readFile throws", async () => {
    vi.mocked(readFile).mockRejectedValueOnce(new Error("permission denied"));

    await uploadMcpConfig(CWD, WRANGLER_PATH);

    expect(providerMock.putValue).not.toHaveBeenCalled();
  });

  it("logs warning when putValue fails", async () => {
    vi.mocked(readFile).mockResolvedValueOnce("{}");
    providerMock.putValue.mockRejectedValueOnce(new Error("kv error"));

    await uploadMcpConfig(CWD, WRANGLER_PATH);

    expect(mockLogWarn).toHaveBeenCalledWith("Could not upload MCP config to KV");
  });

  it("does not throw when putValue fails", async () => {
    vi.mocked(readFile).mockResolvedValueOnce("{}");
    providerMock.putValue.mockRejectedValueOnce(new Error("kv error"));

    await expect(uploadMcpConfig(CWD, WRANGLER_PATH)).resolves.toBeUndefined();
  });
});

describe("pushSingleAgent", () => {
  it("returns failed when agentPath does not exist", async () => {
    vi.mocked(access).mockRejectedValueOnce(new Error("ENOENT"));

    const result = await pushSingleAgent({
      cwd: CWD,
      agentName: AGENT_NAME,
      agentPath: AGENT_PATH,
      state: makeInitialState() as unknown as ReturnType<typeof createInitialState>,
      wranglerConfigPath: WRANGLER_PATH,
      spinner: makeFakeSpinner() as unknown as ReturnType<typeof import("@clack/prompts").spinner>,
    });

    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.error).toContain("missing");
    }
  });

  it("compiles and pushes on first push (no existing hash)", async () => {
    const manifest = makeManifest();
    vi.mocked(access).mockResolvedValueOnce(undefined);
    vi.mocked(readAgentManifest).mockResolvedValueOnce(manifest);
    vi.mocked(computePushHash).mockReturnValueOnce("hash-123");
    vi.mocked(validateCompiledIR).mockReturnValueOnce({ ok: true });

    const state = makeInitialState();
    const spinner = makeFakeSpinner();

    const result = await pushSingleAgent({
      cwd: CWD,
      agentName: AGENT_NAME,
      agentPath: AGENT_PATH,
      state: state as unknown as ReturnType<typeof createInitialState>,
      wranglerConfigPath: WRANGLER_PATH,
      spinner: spinner as unknown as ReturnType<typeof import("@clack/prompts").spinner>,
    });

    expect(result.status).toBe("pushed");
    if (result.status === "pushed") {
      expect(result.agentState.currentVersion).toBe(1);
      expect(result.agentState.currentHash).toBe("hash-123");
      expect(result.agentState.workerUrl).toContain(AGENT_NAME);
    }
    expect(spinner.start).toHaveBeenCalled();
    expect(spinner.stop).toHaveBeenCalled();
    expect(pushRemoteManifest).toHaveBeenCalledWith({
      cwd: CWD,
      wranglerConfigPath: WRANGLER_PATH,
      agentName: AGENT_NAME,
      hash: "hash-123",
      manifest,
    });
    expect(exportCompiledIrForDebug).toHaveBeenCalledWith({
      cwd: CWD,
      agentName: AGENT_NAME,
      manifest,
    });
  });

  it("skips push when hash matches lastRemoteHash", async () => {
    const manifest = makeManifest();
    vi.mocked(access).mockResolvedValueOnce(undefined);
    vi.mocked(readAgentManifest).mockResolvedValueOnce(manifest);
    vi.mocked(computePushHash).mockReturnValueOnce("same-hash");
    vi.mocked(validateCompiledIR).mockReturnValueOnce({ ok: true });

    const state = makeInitialState();
    const spinner = makeFakeSpinner();
    const { ensureAgentState } = await import("@/utils/push/agent-state");
    const agentState = ensureAgentState(state as unknown as ReturnType<typeof createInitialState>, AGENT_NAME, AGENT_PATH);
    agentState.lastRemoteHash = "same-hash";

    const result = await pushSingleAgent({
      cwd: CWD,
      agentName: AGENT_NAME,
      agentPath: AGENT_PATH,
      state: state as unknown as ReturnType<typeof createInitialState>,
      wranglerConfigPath: WRANGLER_PATH,
      spinner: spinner as unknown as ReturnType<typeof import("@clack/prompts").spinner>,
    });

    expect(result.status).toBe("skipped");
    expect(pushRemoteManifest).not.toHaveBeenCalled();
  });

  it("returns failed when validation fails", async () => {
    const manifest = makeManifest();
    vi.mocked(access).mockResolvedValueOnce(undefined);
    vi.mocked(readAgentManifest).mockResolvedValueOnce(manifest);
    vi.mocked(computePushHash).mockReturnValueOnce("hash-123");
    vi.mocked(validateCompiledIR).mockReturnValueOnce({
      ok: false,
      phase: "ir",
      errors: ["invalid graph"],
    });

    const spinner = makeFakeSpinner();

    const result = await pushSingleAgent({
      cwd: CWD,
      agentName: AGENT_NAME,
      agentPath: AGENT_PATH,
      state: makeInitialState() as unknown as ReturnType<typeof createInitialState>,
      wranglerConfigPath: WRANGLER_PATH,
      spinner: spinner as unknown as ReturnType<typeof import("@clack/prompts").spinner>,
    });

    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.error).toContain("validation failed");
    }
    expect(spinner.stop).toHaveBeenCalled();
  });

  it("returns failed when readAgentManifest throws", async () => {
    vi.mocked(access).mockResolvedValueOnce(undefined);
    vi.mocked(readAgentManifest).mockRejectedValueOnce(new Error("compilation error"));

    const spinner = makeFakeSpinner();

    const result = await pushSingleAgent({
      cwd: CWD,
      agentName: AGENT_NAME,
      agentPath: AGENT_PATH,
      state: makeInitialState() as unknown as ReturnType<typeof createInitialState>,
      wranglerConfigPath: WRANGLER_PATH,
      spinner: spinner as unknown as ReturnType<typeof import("@clack/prompts").spinner>,
    });

    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.error).toBe("compilation error");
    }
  });

  it("returns failed when pushRemoteManifest throws", async () => {
    const manifest = makeManifest();
    vi.mocked(access).mockResolvedValueOnce(undefined);
    vi.mocked(readAgentManifest).mockResolvedValueOnce(manifest);
    vi.mocked(computePushHash).mockReturnValueOnce("hash-123");
    vi.mocked(validateCompiledIR).mockReturnValueOnce({ ok: true });
    vi.mocked(pushRemoteManifest).mockRejectedValueOnce(new Error("push error"));

    const spinner = makeFakeSpinner();

    const result = await pushSingleAgent({
      cwd: CWD,
      agentName: AGENT_NAME,
      agentPath: AGENT_PATH,
      state: makeInitialState() as unknown as ReturnType<typeof createInitialState>,
      wranglerConfigPath: WRANGLER_PATH,
      spinner: spinner as unknown as ReturnType<typeof import("@clack/prompts").spinner>,
    });

    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.error).toBe("push error");
    }
  });

  it("increments version on successful push", async () => {
    const manifest = makeManifest();
    vi.mocked(access).mockResolvedValueOnce(undefined);
    vi.mocked(readAgentManifest).mockResolvedValueOnce(manifest);
    vi.mocked(computePushHash).mockReturnValueOnce("hash-123");
    vi.mocked(validateCompiledIR).mockReturnValueOnce({ ok: true });

    const state = makeInitialState();
    const spinner = makeFakeSpinner();
    const { ensureAgentState } = await import("@/utils/push/agent-state");
    const agentState = ensureAgentState(state as unknown as ReturnType<typeof createInitialState>, AGENT_NAME, AGENT_PATH);
    agentState.currentVersion = 3;

    const result = await pushSingleAgent({
      cwd: CWD,
      agentName: AGENT_NAME,
      agentPath: AGENT_PATH,
      state: state as unknown as ReturnType<typeof createInitialState>,
      wranglerConfigPath: WRANGLER_PATH,
      spinner: spinner as unknown as ReturnType<typeof import("@clack/prompts").spinner>,
    });

    expect(result.status).toBe("pushed");
    if (result.status === "pushed") {
      expect(result.agentState.currentVersion).toBe(4);
    }
  });

  it("sets lastPushedAt on successful push", async () => {
    const manifest = makeManifest();
    vi.mocked(access).mockResolvedValueOnce(undefined);
    vi.mocked(readAgentManifest).mockResolvedValueOnce(manifest);
    vi.mocked(computePushHash).mockReturnValueOnce("hash-123");
    vi.mocked(validateCompiledIR).mockReturnValueOnce({ ok: true });

    const state = makeInitialState();
    const spinner = makeFakeSpinner();

    const before = new Date().toISOString();
    const result = await pushSingleAgent({
      cwd: CWD,
      agentName: AGENT_NAME,
      agentPath: AGENT_PATH,
      state: state as unknown as ReturnType<typeof createInitialState>,
      wranglerConfigPath: WRANGLER_PATH,
      spinner: spinner as unknown as ReturnType<typeof import("@clack/prompts").spinner>,
    });
    const after = new Date().toISOString();

    expect(result.status).toBe("pushed");
    if (result.status === "pushed") {
      expect(result.agentState.lastPushedAt).toBeTruthy();
      const pushedTime = result.agentState.lastPushedAt!;
      expect(pushedTime >= before).toBe(true);
      expect(pushedTime <= after).toBe(true);
    }
  });

  it("handles non-Error throws", async () => {
    vi.mocked(access).mockResolvedValueOnce(undefined);
    vi.mocked(readAgentManifest).mockRejectedValueOnce("string error");

    const spinner = makeFakeSpinner();

    const result = await pushSingleAgent({
      cwd: CWD,
      agentName: AGENT_NAME,
      agentPath: AGENT_PATH,
      state: makeInitialState() as unknown as ReturnType<typeof createInitialState>,
      wranglerConfigPath: WRANGLER_PATH,
      spinner: spinner as unknown as ReturnType<typeof import("@clack/prompts").spinner>,
    });

    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.error).toBe("string error");
    }
  });

  it("includes validation error details in failed result", async () => {
    const manifest = makeManifest();
    vi.mocked(access).mockResolvedValueOnce(undefined);
    vi.mocked(readAgentManifest).mockResolvedValueOnce(manifest);
    vi.mocked(computePushHash).mockReturnValueOnce("hash-123");
    vi.mocked(validateCompiledIR).mockReturnValueOnce({
      ok: false,
      phase: "bindings",
      errors: ["binding missing", "type mismatch"],
    });

    const spinner = makeFakeSpinner();

    const result = await pushSingleAgent({
      cwd: CWD,
      agentName: AGENT_NAME,
      agentPath: AGENT_PATH,
      state: makeInitialState() as unknown as ReturnType<typeof createInitialState>,
      wranglerConfigPath: WRANGLER_PATH,
      spinner: spinner as unknown as ReturnType<typeof import("@clack/prompts").spinner>,
    });

    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.error).toContain("binding missing");
      expect(result.error).toContain("type mismatch");
    }
  });
});

describe("PushOutcome discriminated union", () => {
  it("narrows to skipped", () => {
    const outcome: PushOutcome = { status: "skipped" };
    if (outcome.status === "skipped") {
      expect(true).toBe(true);
    }
  });

  it("narrows to pushed with agentState", () => {
    const outcome: PushOutcome = {
      status: "pushed",
      agentState: {
        currentHash: "abc",
        currentVersion: 1,
        lastLocalHash: null,
        lastRemoteHash: null,
        lastPushedAt: null,
        localPath: "/path",
        workerUrl: null,
      },
      manifest: {} as unknown as (AgentManifestV3 & { hash: string }),
    };

    if (outcome.status === "pushed") {
      expect(outcome.agentState.currentVersion).toBe(1);
    }
  });

  it("narrows to failed with error", () => {
    const outcome: PushOutcome = {
      status: "failed",
      error: "something broke",
    };

    if (outcome.status === "failed") {
      expect(outcome.error).toBe("something broke");
    }
  });
});
