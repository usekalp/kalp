import { describe, it, expect, vi, beforeEach } from "vitest";
import { execa } from "execa";
import { rm, writeFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";

import {
  parseNamespaceList,
  parseKvKeyList,
  kvPutManifest,
  kvPutValue,
  kvGetValue,
  kvDeleteValue,
  kvListKeys,
  kvListNamespaces,
  kvPutBulkValues,
} from "@/utils/providers/cloudflare-kv";

vi.mock("execa");
vi.mock("node:fs/promises");
vi.mock("node:os", () => ({
  tmpdir: vi.fn(),
}));

const mockedExeca = vi.mocked(execa) as unknown as ReturnType<typeof vi.fn>;
const mockedMkdtemp = vi.mocked(mkdtemp);
const mockedWriteFile = vi.mocked(writeFile);
const mockedRm = vi.mocked(rm);
const mockedTmpdir = vi.mocked(tmpdir);

beforeEach(() => {
  vi.clearAllMocks();
  mockedTmpdir.mockReturnValue("/fake/tmp");
});

function makeExecaResult(stdout: string, stderr = "") {
  return { stdout, stderr, exitCode: 0, failed: false, isCanceled: false, killed: false };
}

// -------------------------------------------------
// parseNamespaceList
// -------------------------------------------------
describe("parseNamespaceList", () => {
  it("parses a valid JSON array of namespaces", () => {
    const result = parseNamespaceList(
      JSON.stringify([
        { id: "abc123", title: "namespace-a" },
        { id: "def456", title: "namespace-b" },
      ])
    );
    expect(result).toEqual([
      { id: "abc123", title: "namespace-a" },
      { id: "def456", title: "namespace-b" },
    ]);
  });

  it("filters out entries with missing id", () => {
    const result = parseNamespaceList(
      JSON.stringify([
        { id: "", title: "no-id" },
        { id: "keep", title: "valid" },
      ])
    );
    expect(result).toEqual([{ id: "keep", title: "valid" }]);
  });

  it("filters out entries with missing title", () => {
    const result = parseNamespaceList(
      JSON.stringify([
        { id: "keep", title: "" },
        { id: "other", title: "valid" },
      ])
    );
    expect(result).toEqual([{ id: "other", title: "valid" }]);
  });

  it("returns empty array for invalid JSON", () => {
    expect(parseNamespaceList("not-json")).toEqual([]);
  });

  it("returns empty array for non-array JSON", () => {
    expect(parseNamespaceList(JSON.stringify({ not: "array" }))).toEqual([]);
  });

  it("returns empty array for empty string", () => {
    expect(parseNamespaceList("")).toEqual([]);
  });

  it("coerces id and title to strings", () => {
    const result = parseNamespaceList(
      JSON.stringify([{ id: 123, title: 456 }])
    );
    expect(result).toEqual([{ id: "123", title: "456" }]);
  });
});

// -------------------------------------------------
// parseKvKeyList
// -------------------------------------------------
describe("parseKvKeyList", () => {
  it("parses valid JSON array of keys", () => {
    const result = parseKvKeyList(
      JSON.stringify([{ name: "key1" }, { name: "key2" }])
    );
    expect(result).toEqual([{ name: "key1" }, { name: "key2" }]);
  });

  it("returns empty array for empty string", () => {
    expect(parseKvKeyList("")).toEqual([]);
  });

  it("returns empty array for whitespace only", () => {
    expect(parseKvKeyList("   ")).toEqual([]);
  });

  it("returns empty array for invalid JSON", () => {
    expect(parseKvKeyList("{broken")).toEqual([]);
  });

  it("returns empty array for non-array JSON", () => {
    expect(parseKvKeyList(JSON.stringify({ obj: true }))).toEqual([]);
  });

  it("filters out entries with missing or empty name", () => {
    const result = parseKvKeyList(
      JSON.stringify([{ name: "" }, { other: true }, { name: "valid" }])
    );
    expect(result).toEqual([{ name: "valid" }]);
  });

  it("returns empty array for null entries (caught by try/catch)", () => {
    const result = parseKvKeyList(JSON.stringify([null, { name: "real" }]));
    expect(result).toEqual([]);
  });
});

// -------------------------------------------------
// kvPutManifest
// -------------------------------------------------
describe("kvPutManifest", () => {
  it("calls wrangler kv key put with correct args", async () => {
    mockedExeca.mockResolvedValueOnce(makeExecaResult(""));
    await kvPutManifest("/cwd", "/cwd/wrangler.jsonc", "agent/abc", "/path/manifest.json");

    expect(mockedExeca).toHaveBeenCalledWith(
      "npx",
      [
        "wrangler", "kv", "key", "put",
        "--binding", "KALP_MANIFESTS",
        "agent/abc",
        "--path", "/path/manifest.json",
        "--remote",
        "--config", "/cwd/wrangler.jsonc",
      ],
      { cwd: "/cwd" }
    );
  });
});

// -------------------------------------------------
// kvPutValue
// -------------------------------------------------
describe("kvPutValue", () => {
  it("writes value to temp file and calls wrangler", async () => {
    mockedMkdtemp.mockResolvedValueOnce("/fake/tmp/kalp-kv-put-xyz");
    mockedWriteFile.mockResolvedValueOnce(undefined);
    mockedRm.mockResolvedValueOnce(undefined);
    mockedExeca.mockResolvedValueOnce(makeExecaResult(""));

    await kvPutValue("/cwd", "/cwd/wrangler.jsonc", "my-key", "my value content");

    expect(mockedMkdtemp).toHaveBeenCalledWith(expect.stringContaining("kalp-kv-put-"));
    const writtenPath = mockedWriteFile.mock.calls[0]![0] as string;
    expect(writtenPath).toContain("payload.txt");
    expect(mockedWriteFile.mock.calls[0]![1]).toBe("my value content");
    expect(mockedExeca).toHaveBeenCalled();
    expect(mockedRm).toHaveBeenCalledWith("/fake/tmp/kalp-kv-put-xyz", expect.objectContaining({}));
  });

  it("cleans up temp file even on error", async () => {
    mockedMkdtemp.mockResolvedValueOnce("/fake/tmp/kalp-kv-put-err");
    mockedWriteFile.mockResolvedValueOnce(undefined);
    mockedExeca.mockRejectedValueOnce(new Error("wrangler failed"));
    mockedRm.mockResolvedValueOnce(undefined);

    await expect(
      kvPutValue("/cwd", "/cwd/wrangler.jsonc", "key", "val")
    ).rejects.toThrow("wrangler failed");

    expect(mockedRm).toHaveBeenCalledWith("/fake/tmp/kalp-kv-put-err", expect.objectContaining({}));
  });
});

// -------------------------------------------------
// kvGetValue
// -------------------------------------------------
describe("kvGetValue", () => {
  it("returns stdout when result is available", async () => {
    mockedExeca.mockResolvedValueOnce(makeExecaResult("my-value\n"));
    const value = await kvGetValue("/cwd", "/cwd/wrangler.jsonc", "key1");
    expect(value).toBe("my-value");
  });

  it("returns null when output is empty", async () => {
    mockedExeca.mockResolvedValueOnce(makeExecaResult(""));
    const value = await kvGetValue("/cwd", "/cwd/wrangler.jsonc", "key1");
    expect(value).toBeNull();
  });

  it("returns null when stdout is whitespace only", async () => {
    mockedExeca.mockResolvedValueOnce(makeExecaResult("   \n"));
    const value = await kvGetValue("/cwd", "/cwd/wrangler.jsonc", "key1");
    expect(value).toBeNull();
  });

  it("returns null when execa rejects", async () => {
    mockedExeca.mockRejectedValueOnce(new Error("network error"));
    const value = await kvGetValue("/cwd", "/cwd/wrangler.jsonc", "key1");
    expect(value).toBeNull();
  });

  it("calls wrangler kv key get with correct args", async () => {
    mockedExeca.mockResolvedValueOnce(makeExecaResult("data"));
    await kvGetValue("/cwd", "/cwd/wrangler.jsonc", "my-key");
    expect(mockedExeca).toHaveBeenCalledWith(
      "npx",
      expect.arrayContaining([
        "wrangler", "kv", "key", "get",
        "--binding", "KALP_MANIFESTS",
        "my-key",
        "--remote",
        "--config", "/cwd/wrangler.jsonc",
      ]),
      { cwd: "/cwd" }
    );
  });
});

// -------------------------------------------------
// kvDeleteValue
// -------------------------------------------------
describe("kvDeleteValue", () => {
  it("calls wrangler delete with correct args", async () => {
    mockedExeca.mockResolvedValueOnce(makeExecaResult(""));
    await kvDeleteValue("/cwd", "/cwd/wrangler.jsonc", "delete-me");

    expect(mockedExeca).toHaveBeenCalledWith(
      "npx",
      expect.arrayContaining([
        "wrangler", "kv", "key", "delete",
        "--binding", "KALP_MANIFESTS",
        "delete-me",
        "--remote",
        "--config", "/cwd/wrangler.jsonc",
      ]),
      { cwd: "/cwd" }
    );
  });
});

// -------------------------------------------------
// kvListKeys
// -------------------------------------------------
describe("kvListKeys", () => {
  it("lists keys with prefix using JSON format first", async () => {
    mockedExeca.mockResolvedValueOnce(
      makeExecaResult(JSON.stringify([{ name: "pfx/key1" }, { name: "pfx/key2" }]))
    );
    const keys = await kvListKeys("/cwd", "/cwd/wrangler.jsonc", "pfx/");
    expect(keys).toEqual([{ name: "pfx/key1" }, { name: "pfx/key2" }]);
  });

  it("falls back to plain format when JSON fails", async () => {
    mockedExeca
      .mockRejectedValueOnce(new Error("no json"))
      .mockResolvedValueOnce(
        makeExecaResult(JSON.stringify([{ name: "fallback-key" }]))
      );
    const keys = await kvListKeys("/cwd", "/cwd/wrangler.jsonc", "pfx/");
    expect(keys).toEqual([{ name: "fallback-key" }]);
  });

  it("lists without prefix when prefix is empty", async () => {
    mockedExeca.mockResolvedValueOnce(
      makeExecaResult(JSON.stringify([{ name: "all-keys" }]))
    );
    await kvListKeys("/cwd", "/cwd/wrangler.jsonc", "");
    const args = mockedExeca.mock.calls[0]![1] as string[];
    expect(args).not.toContain("--prefix");
  });

  it("trims whitespace from prefix", async () => {
    mockedExeca.mockResolvedValueOnce(
      makeExecaResult(JSON.stringify([{ name: "trimmed-key" }]))
    );
    await kvListKeys("/cwd", "/cwd/wrangler.jsonc", "  trimmed-prefix  ");
    const args = mockedExeca.mock.calls[0]![1] as string[];
    const prefixIdx = args.indexOf("--prefix");
    expect(prefixIdx).toBeGreaterThan(-1);
    expect(args[prefixIdx + 1]).toBe("trimmed-prefix");
  });
});

// -------------------------------------------------
// kvListNamespaces
// -------------------------------------------------
describe("kvListNamespaces", () => {
  it("lists namespaces with JSON flag", async () => {
    mockedExeca.mockResolvedValueOnce(
      makeExecaResult(JSON.stringify([{ id: "ns1", title: "My NS" }]))
    );
    const result = await kvListNamespaces("/cwd", "/cwd/wrangler.jsonc");
    expect(result).toEqual([{ id: "ns1", title: "My NS" }]);
  });

  it("falls back to plain format when JSON request fails", async () => {
    mockedExeca
      .mockRejectedValueOnce(new Error("no json support"))
      .mockResolvedValueOnce(
        makeExecaResult(JSON.stringify([{ id: "ns2", title: "Fallback" }]))
      );
    const result = await kvListNamespaces("/cwd", "/cwd/wrangler.jsonc");
    expect(result).toEqual([{ id: "ns2", title: "Fallback" }]);
  });

  it("calls wrangler with --json flag first", async () => {
    mockedExeca.mockResolvedValueOnce(
      makeExecaResult(JSON.stringify([]))
    );
    await kvListNamespaces("/cwd", "/cwd/wrangler.jsonc");
    const firstArgs = mockedExeca.mock.calls[0]![1] as string[];
    expect(firstArgs).toContain("--json");
  });
});

// -------------------------------------------------
// kvPutBulkValues
// -------------------------------------------------
describe("kvPutBulkValues", () => {
  it("no-ops when values array is empty", async () => {
    await kvPutBulkValues("/cwd", "/cwd/wrangler.jsonc", []);
    expect(mockedExeca).not.toHaveBeenCalled();
  });

  it("writes values to temp JSON file and calls wrangler", async () => {
    mockedMkdtemp.mockResolvedValueOnce("/fake/tmp/kalp-kv-bulk-xyz");
    mockedWriteFile.mockResolvedValueOnce(undefined);
    mockedRm.mockResolvedValueOnce(undefined);
    mockedExeca.mockResolvedValueOnce(makeExecaResult(""));

    await kvPutBulkValues("/cwd", "/cwd/wrangler.jsonc", [
      { key: "k1", value: "v1" },
      { key: "k2", value: "v2" },
    ]);

    expect(mockedMkdtemp).toHaveBeenCalledWith(expect.stringContaining("kalp-kv-bulk-put-"));
    expect(mockedExeca).toHaveBeenCalledWith(
      "npx",
      expect.arrayContaining([
        "wrangler", "kv", "bulk", "put",
        expect.stringContaining("payload.json"),
        "--binding", "KALP_MANIFESTS",
        "--remote",
        "--config", "/cwd/wrangler.jsonc",
      ]),
      { cwd: "/cwd" }
    );
  });
});
