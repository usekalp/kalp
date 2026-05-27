import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { ProjectSynchronizer, synchronizer } from "@/utils/sync";
import type { ProjectGenerator, GeneratorResult, SyncManifest } from "@/utils/sync";

function makeGenerator(
  overrides: Partial<ProjectGenerator> & { result?: GeneratorResult; error?: Error } = {},
): ProjectGenerator {
  return {
    id: overrides.id ?? "gen-1",
    name: overrides.name ?? "Test Generator",
    generate: vi.fn().mockImplementation(async () => {
      if (overrides.error) throw overrides.error;
      return overrides.result ?? { updated: true };
    }),
  };
}

describe("ProjectSynchronizer", () => {
  let sync: ProjectSynchronizer;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(mkdir).mockResolvedValue(undefined);
    vi.mocked(writeFile).mockResolvedValue(undefined);
    sync = new ProjectSynchronizer();
  });

  describe("register", () => {
    it("adds a generator to the internal registry", async () => {
      const gen = makeGenerator({ id: "my-gen" });
      vi.mocked(readFile).mockRejectedValue(new Error("ENOENT"));

      sync.register(gen);
      const results = await sync.run("/test");

      expect(results).toHaveProperty("my-gen");
      expect(results["my-gen"]!.updated).toBe(true);
    });

    it("returns this for fluent chaining", () => {
      const gen = makeGenerator({ id: "g1" });

      const result = sync.register(gen);

      expect(result).toBe(sync);
    });

    it("overwrites generator with same id", async () => {
      const gen1 = makeGenerator({ id: "same", result: { updated: true } });
      const gen2 = makeGenerator({ id: "same", result: { updated: false } });
      vi.mocked(readFile).mockRejectedValue(new Error("ENOENT"));

      sync.register(gen1);
      sync.register(gen2);
      const results = await sync.run("/test");

      expect(results["same"]!.updated).toBe(false);
    });
  });

  describe("run", () => {
    it("executes all registered generators", async () => {
      const gen1 = makeGenerator({ id: "a", result: { updated: true } });
      const gen2 = makeGenerator({ id: "b", result: { updated: true } });
      vi.mocked(readFile).mockRejectedValue(new Error("ENOENT"));

      sync.register(gen1).register(gen2);
      const results = await sync.run("/test");

      expect(results).toHaveProperty("a");
      expect(results).toHaveProperty("b");
      expect(gen1.generate).toHaveBeenCalledWith("/test");
      expect(gen2.generate).toHaveBeenCalledWith("/test");
    });

    it("filters generators by ids option", async () => {
      const gen1 = makeGenerator({ id: "a", result: { updated: true } });
      const gen2 = makeGenerator({ id: "b", result: { updated: true } });
      vi.mocked(readFile).mockRejectedValue(new Error("ENOENT"));

      sync.register(gen1).register(gen2);
      const results = await sync.run("/test", { ids: ["a"] });

      expect(results).toHaveProperty("a");
      expect(results).not.toHaveProperty("b");
      expect(gen1.generate).toHaveBeenCalled();
      expect(gen2.generate).not.toHaveBeenCalled();
    });

    it("logs warning and skips unknown ids", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.mocked(readFile).mockRejectedValue(new Error("ENOENT"));

      const results = await sync.run("/test", { ids: ["nonexistent"] });

      expect(results).toEqual({});
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Generator "nonexistent" not found'),
      );
      warnSpy.mockRestore();
    });

    it("returns empty results object when no generators are registered", async () => {
      vi.mocked(readFile).mockRejectedValue(new Error("ENOENT"));

      const results = await sync.run("/test");

      expect(results).toEqual({});
    });

    it("updates manifest generatedAt timestamp on each run", async () => {
      const gen = makeGenerator({ id: "g", result: { updated: false } });
      vi.mocked(readFile).mockRejectedValue(new Error("ENOENT"));
      sync.register(gen);

      await sync.run("/test");

      expect(writeFile).toHaveBeenCalled();
      const manifestCall = vi.mocked(writeFile).mock.calls.find(
        (call) => (call[0] as string).includes("manifest.json"),
      );
      expect(manifestCall).toBeDefined();
      const written = JSON.parse(manifestCall![1] as string) as SyncManifest;
      expect(written.generatedAt).toBeDefined();
    });

    it("adds generator entry to manifest when result.updated is true", async () => {
      const gen = makeGenerator({ id: "g", result: { updated: true } });
      vi.mocked(readFile).mockRejectedValue(new Error("ENOENT"));
      sync.register(gen);

      await sync.run("/test");

      const manifestCall = vi.mocked(writeFile).mock.calls.find(
        (call) => (call[0] as string).includes("manifest.json"),
      );
      const written = JSON.parse(manifestCall![1] as string) as SyncManifest;
      expect(written.generators).toHaveProperty("g");
      expect(written.generators["g"]!.updatedAt).toBeDefined();
    });

    it("does not add generator entry to manifest when result.updated is false", async () => {
      const gen = makeGenerator({ id: "g", result: { updated: false } });
      vi.mocked(readFile).mockRejectedValue(new Error("ENOENT"));
      sync.register(gen);

      await sync.run("/test");

      const manifestCall = vi.mocked(writeFile).mock.calls.find(
        (call) => (call[0] as string).includes("manifest.json"),
      );
      const written = JSON.parse(manifestCall![1] as string) as SyncManifest;
      expect(written.generators).not.toHaveProperty("g");
    });

    it("propagates generator errors with wrapped message", async () => {
      const gen = makeGenerator({
        id: "failing",
        name: "Bad Generator",
        error: new Error("something broke"),
      });
      vi.mocked(readFile).mockRejectedValue(new Error("ENOENT"));
      sync.register(gen);

      await expect(sync.run("/test")).rejects.toThrow(
        'Generator "Bad Generator" failed: something broke',
      );
    });

    it("writes the manifest file to .kalp/generated/manifest.json", async () => {
      const gen = makeGenerator({ id: "g", result: { updated: true } });
      vi.mocked(readFile).mockRejectedValue(new Error("ENOENT"));
      sync.register(gen);

      await sync.run("/test");

      const manifestCall = vi.mocked(writeFile).mock.calls.find(
        (call) => (call[0] as string).includes("manifest.json"),
      );
      expect(manifestCall).toBeDefined();
      expect(manifestCall![0]).toContain("manifest.json");
    });

    it("creates generated directory before writing", async () => {
      vi.mocked(readFile).mockRejectedValue(new Error("ENOENT"));

      await sync.run("/test");

      expect(mkdir).toHaveBeenCalledWith(
        expect.stringContaining("generated"),
        { recursive: true },
      );
    });

    it("reads existing manifest when available", async () => {
      const existingManifest: SyncManifest = {
        version: 1,
        generatedAt: "2025-01-01T00:00:00.000Z",
        generators: {
          "old-gen": { updatedAt: "2025-01-01T00:00:00.000Z" },
        },
      };
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(existingManifest));
      const gen = makeGenerator({ id: "new-gen", result: { updated: true } });
      sync.register(gen);

      await sync.run("/test");

      const manifestCall = vi.mocked(writeFile).mock.calls.find(
        (call) => (call[0] as string).includes("manifest.json"),
      );
      const written = JSON.parse(manifestCall![1] as string) as SyncManifest;
      expect(written.generators["new-gen"]).toBeDefined();
      expect(written.version).toBe(1);
    });

    it("uses default manifest when file is corrupted", async () => {
      vi.mocked(readFile).mockResolvedValue("not-valid-json{{{");
      const gen = makeGenerator({ id: "g", result: { updated: true } });
      sync.register(gen);

      await sync.run("/test");

      const manifestCall = vi.mocked(writeFile).mock.calls.find(
        (call) => (call[0] as string).includes("manifest.json"),
      );
      const written = JSON.parse(manifestCall![1] as string) as SyncManifest;
      expect(written.version).toBe(1);
    });
  });

  describe("generator results", () => {
    it("passes message from generator result", async () => {
      const gen = makeGenerator({
        id: "msg",
        result: { updated: true, message: "done" },
      });
      vi.mocked(readFile).mockRejectedValue(new Error("ENOENT"));
      sync.register(gen);

      const results = await sync.run("/test");

      expect(results["msg"]!.message).toBe("done");
    });

    it("passes warnings from generator result", async () => {
      const gen = makeGenerator({
        id: "warn",
        result: { updated: true, warnings: ["deprecated setting"] },
      });
      vi.mocked(readFile).mockRejectedValue(new Error("ENOENT"));
      sync.register(gen);

      const results = await sync.run("/test");

      expect(results["warn"]!.warnings).toEqual(["deprecated setting"]);
    });
  });

  describe("global synchronizer", () => {
    it("is an instance of ProjectSynchronizer", () => {
      expect(synchronizer).toBeInstanceOf(ProjectSynchronizer);
    });
  });
});
