import { describe, it, expect, vi, beforeEach } from "vitest";
import { access, mkdir, readdir, writeFile } from "node:fs/promises";
import {
  ensureStudioIndex,
  ensureLiveWorkspaceStudioPlaceholder,
} from "@/utils/runtime/studio-html";

vi.mock("node:fs/promises");

const mockedAccess = vi.mocked(access);
const mockedMkdir = vi.mocked(mkdir);
const mockedReaddir = vi.mocked(readdir);
const mockedWriteFile = vi.mocked(writeFile);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ensureStudioIndex", () => {
  it("returns early when index.html already exists", async () => {
    mockedAccess.mockResolvedValueOnce(undefined);
    await ensureStudioIndex("/fake/studio");
    expect(mockedReaddir).not.toHaveBeenCalled();
    expect(mockedWriteFile).not.toHaveBeenCalled();
  });

  it("generates index.html when missing", async () => {
    mockedAccess.mockRejectedValueOnce(new Error("ENOENT"));
    mockedReaddir.mockResolvedValueOnce([
      "index-Da39a3ee.js",
      "style-abc123.css",
      "other-asset.svg",
    ] as never);

    await ensureStudioIndex("/fake/studio");

    expect(mockedWriteFile).toHaveBeenCalledTimes(1);
    const [filePath, html] = mockedWriteFile.mock.calls[0]!;
    expect(filePath).toContain("index.html");

    expect(html).toContain("<!doctype html>");
    expect(html).toContain('<meta charset="UTF-8" />');
    expect(html).toContain(
      '<meta name="viewport" content="width=device-width, initial-scale=1.0" />'
    );
    expect(html).toContain("<title>Kalp Studio</title>");
    expect(html).toContain('<div id="root"></div>');
  });

  it("finds entry JS by index-*.js pattern", async () => {
    mockedAccess.mockRejectedValueOnce(new Error("ENOENT"));
    mockedReaddir.mockResolvedValueOnce([
      "vendor.js",
      "index-B2c3D4e5.js",
      "chunk.js",
    ] as never);

    await ensureStudioIndex("/fake/studio");

    const [, html] = mockedWriteFile.mock.calls[0]!;
    expect(html).toContain('src="/studio/assets/index-B2c3D4e5.js"');
  });

  it("falls back to any JS file if no index-*.js found", async () => {
    mockedAccess.mockRejectedValueOnce(new Error("ENOENT"));
    mockedReaddir.mockResolvedValueOnce([
      "vendor.js",
      "chunk-abc123.js",
    ] as never);

    await ensureStudioIndex("/fake/studio");

    const [, html] = mockedWriteFile.mock.calls[0]!;
    expect(html).toContain('src="/studio/assets/vendor.js"');
  });

  it("includes CSS link tags sorted", async () => {
    mockedAccess.mockRejectedValueOnce(new Error("ENOENT"));
    mockedReaddir.mockResolvedValueOnce([
      "index-XyZ.js",
      "zebra.css",
      "alpha.css",
      "mid.css",
    ] as never);

    await ensureStudioIndex("/fake/studio");

    const [, html] = mockedWriteFile.mock.calls[0]!;
    expect(html).toContain('href="/studio/assets/alpha.css"');
    expect(html).toContain('href="/studio/assets/mid.css"');
    expect(html).toContain('href="/studio/assets/zebra.css"');
  });

  it("throws when no JS file is found in assets", async () => {
    mockedAccess.mockRejectedValueOnce(new Error("ENOENT"));
    mockedReaddir.mockResolvedValueOnce([
      "styles.css",
      "logo.svg",
    ] as never);

    await expect(ensureStudioIndex("/fake/studio")).rejects.toThrow(
      "missing an entry JS bundle"
    );
    expect(mockedWriteFile).not.toHaveBeenCalled();
  });

  it("handles empty assets directory", async () => {
    mockedAccess.mockRejectedValueOnce(new Error("ENOENT"));
    mockedReaddir.mockResolvedValueOnce([] as never);

    await expect(ensureStudioIndex("/fake/studio")).rejects.toThrow(
      "missing an entry JS bundle"
    );
  });
});

describe("ensureLiveWorkspaceStudioPlaceholder", () => {
  it("creates studio directory if not present", async () => {
    await ensureLiveWorkspaceStudioPlaceholder("/fake/studio");
    expect(mockedMkdir).toHaveBeenCalledWith("/fake/studio", {
      recursive: true,
    });
  });

  it("writes placeholder HTML with correct structure", async () => {
    await ensureLiveWorkspaceStudioPlaceholder("/fake/studio");

    expect(mockedWriteFile).toHaveBeenCalledTimes(1);
    const [filePath, html] = mockedWriteFile.mock.calls[0]!;
    expect(filePath).toContain("index.html");

    expect(html).toContain("<!doctype html>");
    expect(html).toContain('<meta charset="UTF-8" />');
    expect(html).toContain("<title>Kalp Studio</title>");
    expect(html).toContain('<div id="root">Kalp Studio live workspace proxy is starting...</div>');
    expect(html).not.toContain("<script");
  });
});
