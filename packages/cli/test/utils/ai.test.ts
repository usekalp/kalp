import { describe, it, expect, vi, beforeEach } from "vitest";
import { join } from "node:path";

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
}));

import { readFile } from "node:fs/promises";
import { readDotEnv, getRequiredAiSecrets } from "@/utils/ai";

describe("readDotEnv", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("parses key=value pairs", async () => {
    vi.mocked(readFile).mockResolvedValue("KEY1=value1\nKEY2=value2");

    const result = await readDotEnv("/test");

    expect(result).toEqual({ KEY1: "value1", KEY2: "value2" });
  });

  it("filters comment lines starting with #", async () => {
    vi.mocked(readFile).mockResolvedValue("# this is a comment\nKEY=val");

    const result = await readDotEnv("/test");

    expect(result).toEqual({ KEY: "val" });
  });

  it("filters empty lines", async () => {
    vi.mocked(readFile).mockResolvedValue("\n\nKEY=val\n\n");

    const result = await readDotEnv("/test");

    expect(result).toEqual({ KEY: "val" });
  });

  it("filters lines without = sign", async () => {
    vi.mocked(readFile).mockResolvedValue("INVALID_LINE\nKEY=val");

    const result = await readDotEnv("/test");

    expect(result).toEqual({ KEY: "val" });
  });

  it("filters lines where = is at position 0 (empty key)", async () => {
    vi.mocked(readFile).mockResolvedValue("=value\nKEY=val");

    const result = await readDotEnv("/test");

    expect(result).toEqual({ KEY: "val" });
  });

  it("handles missing file gracefully returning empty object", async () => {
    vi.mocked(readFile).mockRejectedValue(new Error("ENOENT"));

    const result = await readDotEnv("/test");

    expect(result).toEqual({});
  });

  it("handles Windows line endings (\\r\\n)", async () => {
    vi.mocked(readFile).mockResolvedValue("KEY1=val1\r\nKEY2=val2");

    const result = await readDotEnv("/test");

    expect(result).toEqual({ KEY1: "val1", KEY2: "val2" });
  });

  it("handles empty file returning empty object", async () => {
    vi.mocked(readFile).mockResolvedValue("");

    const result = await readDotEnv("/test");

    expect(result).toEqual({});
  });

  it("trims keys but full-line trim removes trailing spaces from value", async () => {
    vi.mocked(readFile).mockResolvedValue("  KEY  = value with spaces  ");

    const result = await readDotEnv("/test");

    expect(result).toEqual({ KEY: " value with spaces" });
  });

  it("handles values containing = signs", async () => {
    vi.mocked(readFile).mockResolvedValue("KEY=val=ue");

    const result = await readDotEnv("/test");

    expect(result).toEqual({ KEY: "val=ue" });
  });

  it("reads from .env file in the provided cwd", async () => {
    vi.mocked(readFile).mockResolvedValue("A=1");

    await readDotEnv("/some/path");

    expect(readFile).toHaveBeenCalledWith(
      join("/some/path", ".env"),
      "utf-8",
    );
  });

  it("handles mixed content with comments, blanks, and values", async () => {
    vi.mocked(readFile).mockResolvedValue(
      "# Database\nDB_HOST=localhost\n\nDB_PORT=5432\n# End",
    );

    const result = await readDotEnv("/test");

    expect(result).toEqual({ DB_HOST: "localhost", DB_PORT: "5432" });
  });

  it("returns empty object for whitespace-only content", async () => {
    vi.mocked(readFile).mockResolvedValue("   \n  \t\n  ");

    const result = await readDotEnv("/test");

    expect(result).toEqual({});
  });

  it("handles values with special characters", async () => {
    vi.mocked(readFile).mockResolvedValue(
      "CONN=postgres://user:pass@host/db?sslmode=require",
    );

    const result = await readDotEnv("/test");

    expect(result).toEqual({
      CONN: "postgres://user:pass@host/db?sslmode=require",
    });
  });

  it("handles a single key=value pair", async () => {
    vi.mocked(readFile).mockResolvedValue("SINGLE_KEY=hello");

    const result = await readDotEnv("/test");

    expect(result).toEqual({ SINGLE_KEY: "hello" });
  });
});

describe("getRequiredAiSecrets", () => {
  it("returns an empty array (cloudflare creds come from wrangler auth)", () => {
    const secrets = getRequiredAiSecrets();
    expect(secrets).toEqual([]);
  });
});
