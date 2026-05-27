import { describe, it, expect, vi, beforeEach } from "vitest";
import { access, cp, readdir } from "node:fs/promises";
import {
  runtimeTemplateCandidates,
  resolveRuntimeTemplate,
  copyTemplateRootContents,
  RUNTIME_DIR,
  STUDIO_DIR,
  WORKER_ENTRY_FILE,
  WRANGLER_CONFIG_FILE,
} from "@/utils/runtime/template";

vi.mock("node:fs/promises");

const mockedAccess = vi.mocked(access);
const mockedCp = vi.mocked(cp);
const mockedReaddir = vi.mocked(readdir);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("runtimeTemplateCandidates", () => {
  it("returns candidates for bundled-artifact mode", () => {
    const candidates = runtimeTemplateCandidates("bundled-artifact");
    expect(candidates.length).toBeGreaterThanOrEqual(1);
  });

  it("returns candidates for live-workspace mode (includes extra candidate)", () => {
    const bundled = runtimeTemplateCandidates("bundled-artifact");
    const live = runtimeTemplateCandidates("live-workspace");
    expect(live.length).toBeGreaterThan(bundled.length);
  });

  it("all candidates include templateRoot and workerEntryPath", () => {
    for (const mode of ["bundled-artifact", "live-workspace"] as const) {
      const candidates = runtimeTemplateCandidates(mode);
      for (const c of candidates) {
        expect(c.templateRoot).toBeTruthy();
        expect(c.workerEntryPath).toBeTruthy();
        expect(c.workerEntryPath).toContain(WORKER_ENTRY_FILE);
      }
    }
  });

  it("bundled-artifact candidates include studioTemplateDir", () => {
    const candidates = runtimeTemplateCandidates("bundled-artifact");
    for (const c of candidates) {
      expect(c.studioTemplateDir).toBeTruthy();
      expect(c.studioTemplateDir).toContain("studio");
    }
  });
});

describe("resolveRuntimeTemplate", () => {
  it("resolves to first accessible candidate", async () => {
    mockedAccess.mockRejectedValueOnce(new Error("ENOENT"));
    mockedAccess.mockResolvedValueOnce(undefined);
    mockedAccess.mockResolvedValueOnce(undefined);

    const result = await resolveRuntimeTemplate("bundled-artifact");
    expect(result).toBeDefined();
    expect(result.templateRoot).toBeTruthy();
    expect(result.workerEntryPath).toBeTruthy();
  });

  it("checks both workerEntryPath and studioTemplateDir", async () => {
    mockedAccess
      .mockRejectedValueOnce(new Error("ENOENT"))
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);

    const result = await resolveRuntimeTemplate("bundled-artifact");
    expect(result).toBeDefined();
    expect(mockedAccess).toHaveBeenCalled();
  });

  it("throws when no template is accessible", async () => {
    mockedAccess.mockRejectedValue(new Error("ENOENT"));

    await expect(resolveRuntimeTemplate("bundled-artifact")).rejects.toThrow(
      "Kalp runtime template not found"
    );
  });

  it("skips candidates where workerEntryPath does not exist", async () => {
    const mode = "bundled-artifact" as const;
    void runtimeTemplateCandidates(mode);

    mockedAccess.mockRejectedValue(new Error("ENOENT"));

    await expect(resolveRuntimeTemplate(mode)).rejects.toThrow(
      "Kalp runtime template not found"
    );
    expect(mockedAccess).toHaveBeenCalled();
  });
});

describe("copyTemplateRootContents", () => {
  it("copies all entries except studio directory", async () => {
    mockedReaddir.mockResolvedValueOnce([
      { name: WORKER_ENTRY_FILE, isDirectory: () => false, isFile: () => true, isSymbolicLink: () => false, parentPath: "/tpl", path: "/tpl/worker.js" },
      { name: WRANGLER_CONFIG_FILE, isDirectory: () => false, isFile: () => true, isSymbolicLink: () => false, parentPath: "/tpl", path: "/tpl/wrangler.jsonc" },
      { name: "studio", isDirectory: () => true, isFile: () => false, isSymbolicLink: () => false, parentPath: "/tpl", path: "/tpl/studio" },
      { name: "package.json", isDirectory: () => false, isFile: () => true, isSymbolicLink: () => false, parentPath: "/tpl", path: "/tpl/package.json" },
      { name: "node_modules", isDirectory: () => true, isFile: () => false, isSymbolicLink: () => false, parentPath: "/tpl", path: "/tpl/node_modules" },
    ] as never);

    await copyTemplateRootContents("/fake/template", "/fake/runtime");

    expect(mockedCp).toHaveBeenCalledTimes(4);
    const calls = mockedCp.mock.calls.map((c) => (c[0] as string));

    const nameOf = (p: string) => {
      const s = p.replaceAll("\\", "/");
      return s.split("/").pop()!;
    };
    const calledNames = calls.map(nameOf);

    expect(calledNames).toContain("worker.js");
    expect(calledNames).toContain("wrangler.jsonc");
    expect(calledNames).toContain("package.json");
    expect(calledNames).toContain("node_modules");
    expect(calledNames).not.toContain("studio");
  });

  it("copies to runtime target directory", async () => {
    mockedReaddir.mockResolvedValueOnce([
      { name: "worker.js", isDirectory: () => false, isFile: () => true, isSymbolicLink: () => false, parentPath: "/tpl", path: "/tpl/worker.js" },
    ] as never);

    await copyTemplateRootContents("/fake/template", "/custom/runtime");

    const [[source, target]] = mockedCp.mock.calls as unknown as [[string, string, unknown]];
    expect(source).toBeTruthy();
    expect((source as string).replaceAll("\\", "/")).toMatch(/\/fake\/template\/worker\.js$/);
    expect((target as string).replaceAll("\\", "/")).toMatch(/\/custom\/runtime\/worker\.js$/);
  });

  it("passes recursive and force options to cp", async () => {
    mockedReaddir.mockResolvedValueOnce([
      { name: "dir", isDirectory: () => true, isFile: () => false, isSymbolicLink: () => false, parentPath: "/tpl", path: "/tpl/dir" },
    ] as never);

    await copyTemplateRootContents("/fake/template", "/fake/runtime");

    const [, , options] = mockedCp.mock.calls[0]!;
    expect(options).toEqual({ recursive: true, force: true });
  });
});

describe("constants", () => {
  it("exports expected constant values", () => {
    expect(RUNTIME_DIR).toBe("runtime");
    expect(STUDIO_DIR).toBe("studio");
    expect(WORKER_ENTRY_FILE).toBe("worker.js");
    expect(WRANGLER_CONFIG_FILE).toBe("wrangler.jsonc");
  });
});
