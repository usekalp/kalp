import { describe, it, expect, vi, beforeEach } from "vitest";
import { execa } from "execa";
import {
  parseSecretsList,
  secretPut,
  secretList,
  secretDelete,
} from "@/utils/providers/cloudflare-secrets";

vi.mock("execa");

const mockedExeca = vi.mocked(execa) as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

function makeExecaResult(stdout: string) {
  return { stdout, stderr: "", exitCode: 0, failed: false, isCanceled: false, killed: false };
}

// -------------------------------------------------
// parseSecretsList
// -------------------------------------------------
describe("parseSecretsList", () => {
  it("parses JSON array of secrets", () => {
    const result = parseSecretsList(
      JSON.stringify([
        { name: "API_KEY", type: "secret_text" },
        { name: "DB_PASS" },
      ])
    );
    expect(result).toEqual([
      { name: "API_KEY", type: "secret_text" },
      { name: "DB_PASS" },
    ]);
  });

  it("returns empty array for empty string", () => {
    expect(parseSecretsList("")).toEqual([]);
  });

  it("returns empty array for whitespace only", () => {
    expect(parseSecretsList("    \n  ")).toEqual([]);
  });

  it("returns empty array for invalid JSON", () => {
    expect(parseSecretsList("invalid-json-here")).toEqual([]);
  });

  it("returns empty array for non-array JSON", () => {
    expect(parseSecretsList(JSON.stringify({ key: "val" }))).toEqual([]);
  });

  it("filters out entries without a name", () => {
    const result = parseSecretsList(
      JSON.stringify([{ other: true }, { name: "VALID" }])
    );
    expect(result).toEqual([{ name: "VALID" }]);
  });

  it("filters out entries with empty string name", () => {
    const result = parseSecretsList(
      JSON.stringify([{ name: "" }, { name: "good" }])
    );
    expect(result).toEqual([{ name: "good" }]);
  });

  it("skips type field when not a string", () => {
    const result = parseSecretsList(
      JSON.stringify([{ name: "SEC", type: 123 }])
    );
    expect(result).toEqual([{ name: "SEC" }]);
  });
});

// -------------------------------------------------
// secretPut
// -------------------------------------------------
describe("secretPut", () => {
  it("calls wrangler secret put with correct args", async () => {
    mockedExeca.mockResolvedValueOnce(makeExecaResult(""));
    await secretPut("/cwd", "/cwd/wrangler.jsonc", "MY_SECRET", "secret-value");

    expect(mockedExeca).toHaveBeenCalledWith(
      "npx",
      ["wrangler", "secret", "put", "MY_SECRET", "--config", "/cwd/wrangler.jsonc"],
      { cwd: "/cwd", input: "secret-value\n" }
    );
  });

  it("passes input via stdin to execa", async () => {
    mockedExeca.mockResolvedValueOnce(makeExecaResult(""));
    await secretPut("/cwd", "/cwd/wrangler.jsonc", "KEY", "val\nwith\nnewlines");

    const call = mockedExeca.mock.calls[0]!;
    expect(call[2]).toHaveProperty("input", "val\nwith\nnewlines\n");
  });
});

// -------------------------------------------------
// secretList
// -------------------------------------------------
describe("secretList", () => {
  it("tries JSON format first and parses secrets", async () => {
    mockedExeca.mockResolvedValueOnce(
      makeExecaResult(JSON.stringify([{ name: "SECRET_1" }, { name: "SECRET_2", type: "secret_text" }]))
    );
    const secrets = await secretList("/cwd", "/cwd/wrangler.jsonc");
    expect(secrets).toEqual([
      { name: "SECRET_1" },
      { name: "SECRET_2", type: "secret_text" },
    ]);
  });

  it("falls back to plain format when JSON fails", async () => {
    mockedExeca
      .mockRejectedValueOnce(new Error("no json flag"))
      .mockResolvedValueOnce(
        makeExecaResult(JSON.stringify([{ name: "FALLBACK_SECRET" }]))
      );
    const secrets = await secretList("/cwd", "/cwd/wrangler.jsonc");
    expect(secrets).toEqual([{ name: "FALLBACK_SECRET" }]);
  });

  it("uses --format json on first attempt", async () => {
    mockedExeca.mockResolvedValueOnce(makeExecaResult(JSON.stringify([])));
    await secretList("/cwd", "/cwd/wrangler.jsonc");
    const args = mockedExeca.mock.calls[0]![1] as string[];
    expect(args).toContain("--format");
    expect(args).toContain("json");
  });

  it("returns empty array when JSON fails and fallback has empty output", async () => {
    mockedExeca
      .mockRejectedValueOnce(new Error("json fail"))
      .mockResolvedValueOnce(makeExecaResult(""));
    const secrets = await secretList("/cwd", "/cwd/wrangler.jsonc");
    expect(secrets).toEqual([]);
  });
});

// -------------------------------------------------
// secretDelete
// -------------------------------------------------
describe("secretDelete", () => {
  it("calls wrangler secret delete with correct args", async () => {
    mockedExeca.mockResolvedValueOnce(makeExecaResult(""));
    await secretDelete("/cwd", "/cwd/wrangler.jsonc", "OLD_SECRET");

    expect(mockedExeca).toHaveBeenCalledWith(
      "npx",
      ["wrangler", "secret", "delete", "OLD_SECRET", "--config", "/cwd/wrangler.jsonc"],
      { cwd: "/cwd" }
    );
  });

  it("propagates execa errors", async () => {
    mockedExeca.mockRejectedValueOnce(new Error("secret not found"));
    await expect(
      secretDelete("/cwd", "/cwd/wrangler.jsonc", "NONEXISTENT")
    ).rejects.toThrow("secret not found");
  });
});
