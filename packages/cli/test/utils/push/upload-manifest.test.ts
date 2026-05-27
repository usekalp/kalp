import { describe, it, expect, vi, beforeEach } from "vitest";
import { pushRemoteManifest } from "@/utils/push/upload-manifest";
import type { PushResult } from "@/utils/push/upload-manifest";
import type { AgentManifestV3 } from "@/utils/manifest/types";
import type { SourceMetadataManifest } from "@kalphq/compiler";

const providerMock = {
  putBulkValues: vi.fn(),
  putValue: vi.fn(),
};

vi.mock("@/utils/providers", () => ({
  resolveProvider: () => providerMock,
}));

const CWD = "/test/project";
const WRANGLER_PATH = "/test/wrangler.toml";
const AGENT_NAME = "test-agent";
const HASH = "abc123def";

function makeManifest(overrides: Partial<AgentManifestV3> = {}): AgentManifestV3 {
  return {
    format: "kalp-agent-manifest",
    schemaVersion: 3,
    artifactManifest: { version: 1 } as unknown as AgentManifestV3["artifactManifest"],
    semanticIr: { nodes: [] } as unknown as AgentManifestV3["semanticIr"],
    schemas: { schemas: {} } as unknown as AgentManifestV3["schemas"],
    bundleManifest: {
      targets: { default: { nodes: {} } },
    } as unknown as AgentManifestV3["bundleManifest"],
    bundles: {
      bun1: { file: "handler1.ts", code: "console.log(1)", size: 100, sha256: "sha1" },
      bun2: { file: "handler2.ts", code: "console.log(2)", size: 200, sha256: "sha2" },
    },
    metadata: {},
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("pushRemoteManifest", () => {
  it("uses putBulkValues when provider supports it", async () => {
    const manifest = makeManifest();

    await pushRemoteManifest({
      cwd: CWD,
      wranglerConfigPath: WRANGLER_PATH,
      agentName: AGENT_NAME,
      hash: HASH,
      manifest,
    });

    expect(providerMock.putBulkValues).toHaveBeenCalledTimes(1);
    expect(providerMock.putValue).not.toHaveBeenCalled();

    const call = providerMock.putBulkValues.mock.calls[0][0];
    expect(call.cwd).toBe(CWD);
    expect(call.configPath).toBe(WRANGLER_PATH);

    const keys = call.values.map((v: { key: string }) => v.key);
    expect(keys).toContain(`${AGENT_NAME}:${HASH}:artifact-manifest`);
    expect(keys).toContain(`${AGENT_NAME}:${HASH}:semantic-ir`);
    expect(keys).toContain(`${AGENT_NAME}:${HASH}:schemas`);
    expect(keys).toContain(`${AGENT_NAME}:${HASH}:bundle-manifest`);
    expect(keys).toContain(`${AGENT_NAME}:${HASH}:bundle:bun1`);
    expect(keys).toContain(`${AGENT_NAME}:${HASH}:bundle:bun2`);
    expect(keys).toContain(`${AGENT_NAME}:latest`);
  });

  it("falls back to putValue when provider lacks putBulkValues", async () => {
    const manifest = makeManifest();
    const original = providerMock.putBulkValues;
    // Remove putBulkValues to force fallback
    Reflect.set(providerMock, "putBulkValues", undefined);

    await pushRemoteManifest({
      cwd: CWD,
      wranglerConfigPath: WRANGLER_PATH,
      agentName: AGENT_NAME,
      hash: HASH,
      manifest,
    });

    expect(providerMock.putValue).toHaveBeenCalled();
    // 4 manifest keys + 2 bundles + latest = 7 calls
    expect(providerMock.putValue).toHaveBeenCalledTimes(7);

    // Restore
    Reflect.set(providerMock, "putBulkValues", original);
  });

  it("serializes artifactManifest as JSON string", async () => {
    const manifest = makeManifest({
      artifactManifest: { version: 1, handlers: ["h1"] } as unknown as AgentManifestV3["artifactManifest"],
    });

    await pushRemoteManifest({
      cwd: CWD,
      wranglerConfigPath: WRANGLER_PATH,
      agentName: AGENT_NAME,
      hash: HASH,
      manifest,
    });

    const call = providerMock.putBulkValues.mock.calls[0][0];
    const manifestEntry = call.values.find(
      (v: { key: string }) => v.key === `${AGENT_NAME}:${HASH}:artifact-manifest`,
    );
    expect(JSON.parse(manifestEntry.value)).toEqual({ version: 1, handlers: ["h1"] });
  });

  it("includes sourceMetadata when present", async () => {
    const manifest = makeManifest({
      sourceMetadata: { files: ["a.ts"] } as unknown as SourceMetadataManifest,
    });

    await pushRemoteManifest({
      cwd: CWD,
      wranglerConfigPath: WRANGLER_PATH,
      agentName: AGENT_NAME,
      hash: HASH,
      manifest,
    });

    const call = providerMock.putBulkValues.mock.calls[0][0];
    const keys = call.values.map((v: { key: string }) => v.key);
    expect(keys).toContain(`${AGENT_NAME}:${HASH}:source-metadata`);
  });

  it("does not include sourceMetadata when absent", async () => {
    const manifest = makeManifest();
    delete manifest.sourceMetadata;

    await pushRemoteManifest({
      cwd: CWD,
      wranglerConfigPath: WRANGLER_PATH,
      agentName: AGENT_NAME,
      hash: HASH,
      manifest,
    });

    const call = providerMock.putBulkValues.mock.calls[0][0];
    const keys = call.values.map((v: { key: string }) => v.key);
    expect(keys).not.toContain(`${AGENT_NAME}:${HASH}:source-metadata`);
  });

  it("handles empty bundles object", async () => {
    const manifest = makeManifest({ bundles: {} });

    await pushRemoteManifest({
      cwd: CWD,
      wranglerConfigPath: WRANGLER_PATH,
      agentName: AGENT_NAME,
      hash: HASH,
      manifest,
    });

    const call = providerMock.putBulkValues.mock.calls[0][0];
    const keys = call.values.map((v: { key: string }) => v.key);
    expect(keys.filter((k: string) => k.includes(":bundle:")).length).toBe(0);
  });

  it("sets latest key to the hash value", async () => {
    const manifest = makeManifest();

    await pushRemoteManifest({
      cwd: CWD,
      wranglerConfigPath: WRANGLER_PATH,
      agentName: AGENT_NAME,
      hash: HASH,
      manifest,
    });

    const call = providerMock.putBulkValues.mock.calls[0][0];
    const latest = call.values.find(
      (v: { key: string }) => v.key === `${AGENT_NAME}:latest`,
    );
    expect(latest.value).toBe(HASH);
  });
});

describe("PushResult type", () => {
  it("allows all zero values", () => {
    const result: PushResult = { pushed: 0, skipped: 0, failed: 0 };
    expect(result.pushed).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.failed).toBe(0);
  });

  it("allows mixed values", () => {
    const result: PushResult = { pushed: 5, skipped: 2, failed: 1 };
    expect(result.pushed).toBe(5);
    expect(result.skipped).toBe(2);
    expect(result.failed).toBe(1);
  });

  it("allows large numbers", () => {
    const result: PushResult = { pushed: 1000, skipped: 500, failed: 50 };
    expect(result.pushed).toBe(1000);
  });
});
