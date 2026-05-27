import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  readRemoteAgentsIndex,
  writeRemoteAgentsIndex,
  pruneStaleRemoteAgents,
} from "@/utils/push/remote-index";
import type { RemoteAgentIndexEntry } from "@/utils/push/remote-index";

const { providerMock, mockOutro, mockConfirm, mockIsCancel, mockLog } = vi.hoisted(() => ({
  providerMock: {
    getValue: vi.fn(),
    putManifest: vi.fn(),
    deleteValue: vi.fn(),
    listKeys: vi.fn(),
  },
  mockOutro: vi.fn(),
  mockConfirm: vi.fn(),
  mockIsCancel: vi.fn(),
  mockLog: { warn: vi.fn() },
}));

vi.mock("@/utils/providers", () => ({
  resolveProvider: () => providerMock,
}));

vi.mock("node:fs/promises", async () => {
  const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  return {
    ...actual,
    writeFile: vi.fn(),
    rm: vi.fn(),
  };
});

vi.mock("@clack/prompts", () => ({
  default: mockOutro,
  confirm: mockConfirm,
  isCancel: mockIsCancel,
  outro: mockOutro,
  log: mockLog,
}));

import { writeFile, rm } from "node:fs/promises";

const CWD = "/test/project";
const WRANGLER_PATH = "/test/wrangler.toml";

beforeEach(() => {
  vi.clearAllMocks();
});

function makeEntry(
  overrides: Partial<RemoteAgentIndexEntry> = {},
): RemoteAgentIndexEntry {
  return {
    name: "test-agent",
    hash: "abc123",
    version: "1.0.0",
    versionNumber: 1,
    updatedAt: "2025-01-01T00:00:00Z",
    workerUrl: "https://test.workers.dev/a/test-agent",
    ...overrides,
  };
}

describe("readRemoteAgentsIndex", () => {
  it("returns parsed entries when getValue returns valid JSON array", async () => {
    const entries = [makeEntry(), makeEntry({ name: "agent-2", hash: "def456" })];
    providerMock.getValue.mockResolvedValueOnce(JSON.stringify(entries));

    const result = await readRemoteAgentsIndex(CWD, WRANGLER_PATH);

    expect(result).toEqual(entries);
    expect(providerMock.getValue).toHaveBeenCalledWith({
      cwd: CWD,
      configPath: WRANGLER_PATH,
      key: "agents:index",
    });
  });

  it("returns empty array when getValue returns null", async () => {
    providerMock.getValue.mockResolvedValueOnce(null);

    const result = await readRemoteAgentsIndex(CWD, WRANGLER_PATH);

    expect(result).toEqual([]);
  });

  it("returns empty array when getValue returns empty string", async () => {
    providerMock.getValue.mockResolvedValueOnce("");

    const result = await readRemoteAgentsIndex(CWD, WRANGLER_PATH);

    expect(result).toEqual([]);
  });

  it("returns empty array when getValue throws", async () => {
    providerMock.getValue.mockRejectedValueOnce(new Error("network down"));

    const result = await readRemoteAgentsIndex(CWD, WRANGLER_PATH);

    expect(result).toEqual([]);
  });

  it("returns empty array when JSON is invalid", async () => {
    providerMock.getValue.mockResolvedValueOnce("{ broken json --- }");

    const result = await readRemoteAgentsIndex(CWD, WRANGLER_PATH);

    expect(result).toEqual([]);
  });

  it("returns empty array when JSON parses to non-array value", async () => {
    providerMock.getValue.mockResolvedValueOnce('"just a string"');

    const result = await readRemoteAgentsIndex(CWD, WRANGLER_PATH);

    expect(result).toEqual([]);
  });

  it("returns empty array when JSON parses to object", async () => {
    providerMock.getValue.mockResolvedValueOnce('{ "key": "value" }');

    const result = await readRemoteAgentsIndex(CWD, WRANGLER_PATH);

    expect(result).toEqual([]);
  });

  it("returns empty array when JSON parses to number", async () => {
    providerMock.getValue.mockResolvedValueOnce("42");

    const result = await readRemoteAgentsIndex(CWD, WRANGLER_PATH);

    expect(result).toEqual([]);
  });

  it("returns empty array when JSON parses to null", async () => {
    providerMock.getValue.mockResolvedValueOnce("null");

    const result = await readRemoteAgentsIndex(CWD, WRANGLER_PATH);

    expect(result).toEqual([]);
  });

  it("preserves entries with null version and versionNumber", async () => {
    const entry = makeEntry({ version: null, versionNumber: null });
    providerMock.getValue.mockResolvedValueOnce(JSON.stringify([entry]));

    const result = await readRemoteAgentsIndex(CWD, WRANGLER_PATH);

    expect(result).toHaveLength(1);
    expect(result[0]!.version).toBeNull();
    expect(result[0]!.versionNumber).toBeNull();
  });

  it("returns empty array when getValue returns undefined", async () => {
    providerMock.getValue.mockResolvedValueOnce(undefined);

    const result = await readRemoteAgentsIndex(CWD, WRANGLER_PATH);

    expect(result).toEqual([]);
  });
});

describe("writeRemoteAgentsIndex", () => {
  const entries: RemoteAgentIndexEntry[] = [
    makeEntry(),
    makeEntry({ name: "agent-2", versionNumber: 2 }),
  ];

  it("writes temp file and calls putManifest", async () => {
    await writeRemoteAgentsIndex(CWD, WRANGLER_PATH, entries);

    expect(writeFile).toHaveBeenCalledWith(
      expect.stringContaining(".kalp"),
      JSON.stringify(entries, null, 2),
      "utf-8",
    );
    expect(providerMock.putManifest).toHaveBeenCalledWith({
      cwd: CWD,
      configPath: WRANGLER_PATH,
      key: "agents:index",
      jsonPath: expect.stringContaining("agents-index.json"),
    });
  });

  it("cleans up temp file even when putManifest throws", async () => {
    providerMock.putManifest.mockRejectedValueOnce(new Error("upload failed"));

    await expect(
      writeRemoteAgentsIndex(CWD, WRANGLER_PATH, entries),
    ).rejects.toThrow("upload failed");

    expect(rm).toHaveBeenCalledWith(expect.stringContaining("agents-index.json"), {
      force: true,
    });
  });

  it("cleans up temp file on success", async () => {
    await writeRemoteAgentsIndex(CWD, WRANGLER_PATH, entries);

    expect(rm).toHaveBeenCalledWith(expect.stringContaining("agents-index.json"), {
      force: true,
    });
  });

  it("writes empty array to temp file", async () => {
    await writeRemoteAgentsIndex(CWD, WRANGLER_PATH, []);

    expect(writeFile).toHaveBeenCalledWith(
      expect.stringContaining(".kalp"),
      "[]",
      "utf-8",
    );
    expect(providerMock.putManifest).toHaveBeenCalled();
  });
});

describe("pruneStaleRemoteAgents", () => {
  const staleEntry1 = makeEntry({ name: "stale-1", hash: "stale1" });
  const staleEntry2 = makeEntry({ name: "stale-2", hash: "stale2" });
  const keptEntry = makeEntry({ name: "kept", hash: "kept1" });

  beforeEach(() => {
    providerMock.getValue.mockResolvedValue(null);
    providerMock.deleteValue.mockResolvedValue(undefined);
    providerMock.listKeys.mockResolvedValue([]);
  });

  it("returns empty result when no stale entries", async () => {
    const result = await pruneStaleRemoteAgents({
      cwd: CWD,
      wranglerConfigPath: WRANGLER_PATH,
      remoteEntries: [keptEntry],
      localAgentNames: ["kept"],
    });

    expect(result).toEqual({ removedAgents: [], deletedKeys: 0 });
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  it("returns empty result when remoteEntries is empty", async () => {
    const result = await pruneStaleRemoteAgents({
      cwd: CWD,
      wranglerConfigPath: WRANGLER_PATH,
      remoteEntries: [],
      localAgentNames: ["agent-1"],
    });

    expect(result).toEqual({ removedAgents: [], deletedKeys: 0 });
  });

  it("prompts user when stale entries found", async () => {
    mockConfirm.mockResolvedValueOnce(true);

    await pruneStaleRemoteAgents({
      cwd: CWD,
      wranglerConfigPath: WRANGLER_PATH,
      remoteEntries: [staleEntry1],
      localAgentNames: ["kept"],
    });

    expect(mockConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("stale-1"),
        initialValue: true,
      }),
    );
  });

  it("exits process when user cancels confirmation", async () => {
    mockConfirm.mockResolvedValueOnce(undefined);
    mockIsCancel.mockReturnValueOnce(true);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

    try {
      await pruneStaleRemoteAgents({
        cwd: CWD,
        wranglerConfigPath: WRANGLER_PATH,
        remoteEntries: [staleEntry1],
        localAgentNames: ["kept"],
      });
    } catch {
    }

    expect(mockIsCancel).toHaveBeenCalled();
    expect(mockOutro).toHaveBeenCalledWith("Cancelled");
    expect(exitSpy).toHaveBeenCalledWith(0);
    exitSpy.mockRestore();
  });

  it("returns zero deletes when user declines confirmation", async () => {
    mockConfirm.mockResolvedValueOnce(false);
    mockIsCancel.mockReturnValueOnce(false);

    const result = await pruneStaleRemoteAgents({
      cwd: CWD,
      wranglerConfigPath: WRANGLER_PATH,
      remoteEntries: [staleEntry1],
      localAgentNames: ["kept"],
    });

    expect(result).toEqual({ removedAgents: [], deletedKeys: 0 });
  });

  it("deletes stale entry KV keys on confirmed prune", async () => {
    mockConfirm.mockResolvedValueOnce(true);

    await pruneStaleRemoteAgents({
      cwd: CWD,
      wranglerConfigPath: WRANGLER_PATH,
      remoteEntries: [staleEntry1],
      localAgentNames: ["kept"],
    });

    expect(providerMock.deleteValue).toHaveBeenCalledWith(
      expect.objectContaining({ key: "stale-1:latest" }),
    );
    expect(writeFile).toHaveBeenCalled();
    expect(providerMock.putManifest).toHaveBeenCalled();
  });

  it("counts deleted keys from both latest and artifact deletes", async () => {
    mockConfirm.mockResolvedValueOnce(true);
    providerMock.listKeys.mockResolvedValue([
      { name: "stale-1:stale1:bundle:abc" },
      { name: "stale-1:stale1:artifact-manifest" },
    ]);

    const result = await pruneStaleRemoteAgents({
      cwd: CWD,
      wranglerConfigPath: WRANGLER_PATH,
      remoteEntries: [staleEntry1],
      localAgentNames: ["kept"],
    });

    expect(result.deletedKeys).toBe(3);
  });

  it("handles multiple stale entries", async () => {
    mockConfirm.mockResolvedValueOnce(true);

    const result = await pruneStaleRemoteAgents({
      cwd: CWD,
      wranglerConfigPath: WRANGLER_PATH,
      remoteEntries: [staleEntry1, staleEntry2, keptEntry],
      localAgentNames: ["kept"],
    });

    expect(result.removedAgents).toEqual(["stale-1", "stale-2"]);
  });

  it("handles failed deleteValue gracefully", async () => {
    mockConfirm.mockResolvedValueOnce(true);
    providerMock.deleteValue.mockRejectedValueOnce(new Error("delete failed"));

    const result = await pruneStaleRemoteAgents({
      cwd: CWD,
      wranglerConfigPath: WRANGLER_PATH,
      remoteEntries: [staleEntry1],
      localAgentNames: ["kept"],
    });

    expect(result.deletedKeys).toBe(0);
  });

  it("includes latestHash in artifact deletion when getValue returns it", async () => {
    mockConfirm.mockResolvedValueOnce(true);
    providerMock.getValue.mockResolvedValueOnce("extra-hash");

    await pruneStaleRemoteAgents({
      cwd: CWD,
      wranglerConfigPath: WRANGLER_PATH,
      remoteEntries: [staleEntry1],
      localAgentNames: ["kept"],
    });

    expect(providerMock.listKeys).toHaveBeenCalledTimes(2);
  });

  it("deduplicates hashes when latestHash equals entry hash", async () => {
    mockConfirm.mockResolvedValueOnce(true);
    providerMock.getValue.mockResolvedValueOnce("stale1");

    await pruneStaleRemoteAgents({
      cwd: CWD,
      wranglerConfigPath: WRANGLER_PATH,
      remoteEntries: [staleEntry1],
      localAgentNames: ["kept"],
    });

    expect(providerMock.listKeys).toHaveBeenCalledTimes(1);
  });

  it("shows preview of up to 3 stale agent names", async () => {
    const manyStale = [
      makeEntry({ name: "s-1", hash: "h1" }),
      makeEntry({ name: "s-2", hash: "h2" }),
      makeEntry({ name: "s-3", hash: "h3" }),
      makeEntry({ name: "s-4", hash: "h4" }),
      makeEntry({ name: "s-5", hash: "h5" }),
    ];
    mockConfirm.mockResolvedValueOnce(true);

    await pruneStaleRemoteAgents({
      cwd: CWD,
      wranglerConfigPath: WRANGLER_PATH,
      remoteEntries: manyStale,
      localAgentNames: [],
    });

    expect(mockConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("s-1, s-2, s-3"),
      }),
    );
    expect(mockConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("and 2 more"),
      }),
    );
  });

  it("handles getValue failure gracefully during pruning", async () => {
    mockConfirm.mockResolvedValueOnce(true);
    providerMock.getValue.mockRejectedValueOnce(new Error("get failed"));

    await pruneStaleRemoteAgents({
      cwd: CWD,
      wranglerConfigPath: WRANGLER_PATH,
      remoteEntries: [staleEntry1],
      localAgentNames: ["kept"],
    });

    expect(providerMock.deleteValue).toHaveBeenCalled();
  });

  it("handles listKeys failure gracefully", async () => {
    mockConfirm.mockResolvedValueOnce(true);
    providerMock.listKeys.mockRejectedValueOnce(new Error("list failed"));

    const result = await pruneStaleRemoteAgents({
      cwd: CWD,
      wranglerConfigPath: WRANGLER_PATH,
      remoteEntries: [staleEntry1],
      localAgentNames: ["kept"],
    });

    expect(result.deletedKeys).toBe(1);
  });

  it("sorts removedAgents alphabetically", async () => {
    const unordered = [
      makeEntry({ name: "z-agent", hash: "zh" }),
      makeEntry({ name: "a-agent", hash: "ah" }),
      makeEntry({ name: "m-agent", hash: "mh" }),
    ];
    mockConfirm.mockResolvedValueOnce(true);

    const result = await pruneStaleRemoteAgents({
      cwd: CWD,
      wranglerConfigPath: WRANGLER_PATH,
      remoteEntries: unordered,
      localAgentNames: [],
    });

    expect(result.removedAgents).toEqual(["a-agent", "m-agent", "z-agent"]);
  });
});
