import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/utils/project-config", () => ({
  loadProjectConfig: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { loadProjectConfig } from "@/utils/project-config";
import { ProjectTypesGenerator, generateTypes } from "@/utils/codegen";

describe("ProjectTypesGenerator", () => {
  let generator: ProjectTypesGenerator;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(mkdir).mockResolvedValue(undefined);
    vi.mocked(writeFile).mockResolvedValue(undefined);
    generator = new ProjectTypesGenerator();
  });

  function mockConfig(secrets: unknown, models: unknown) {
    vi.mocked(loadProjectConfig).mockResolvedValue({
      path: "/test/kalp.config.ts",
      raw: {
        secrets,
        ai: { models },
      },
    });
  }

  it("returns id 'project' and name 'Project Types'", () => {
    expect(generator.id).toBe("project");
    expect(generator.name).toBe("Project Types");
  });

  it("generates .d.ts content with secrets and model tier keys", async () => {
    mockConfig(["SECRET_A", "SECRET_B"], { tier1: {}, tier2: {} });
    vi.mocked(readFile).mockRejectedValue(new Error("ENOENT"));

    const result = await generator.generate("/test");

    expect(result.updated).toBe(true);
    expect(writeFile).toHaveBeenCalledTimes(1);

    const call = vi.mocked(writeFile).mock.calls[0]!! as unknown[];
    const writtenPath = call[0] as string;
    const writtenContent = call[1] as string;

    expect(writtenPath).toContain("project.d.ts");
    expect(writtenContent).toContain('readonly ["SECRET_A", "SECRET_B"]');
    expect(writtenContent).toContain('readonly ["tier1", "tier2"]');
  });

  it("returns updated: false when existing content matches", async () => {
    mockConfig(["SECRET_X"], {});
    const existing = [
      '// \u{1F98B} Kalp Generated Types',
      '// This file is auto-generated. Do not edit manually.',
      'import "@kalphq/sdk";',
      '',
      '/**',
      ' * Registered secrets from kalp.config.ts',
      ' * @generated',
      ' */',
      'export type RegisteredSecretKeys = readonly ["SECRET_X"];',
      '',
      '/**',
      ' * AI model tier keys resolved from cloudflare config',
      ' * @generated',
      ' */',
      'export type ConfiguredAIModelTiers = readonly [];',
      '',
      'declare module "@kalphq/sdk" {',
      '  interface SecretsRegistry {',
      '    keys: RegisteredSecretKeys;',
      '  }',
      '',
      '  interface KalpAITierRegistry {',
      '    keys: ConfiguredAIModelTiers;',
      '  }',
      '}',
      '',
    ].join("\n");
    vi.mocked(readFile).mockResolvedValue(existing);

    const result = await generator.generate("/test");

    expect(result.updated).toBe(false);
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("returns updated: true when existing file differs", async () => {
    mockConfig(["NEW_SECRET"], {});
    vi.mocked(readFile).mockResolvedValue("// old content that differs");

    const result = await generator.generate("/test");

    expect(result.updated).toBe(true);
    expect(writeFile).toHaveBeenCalled();
  });

  it("returns updated: true when file does not exist", async () => {
    mockConfig([], {});
    vi.mocked(readFile).mockRejectedValue(new Error("ENOENT"));

    const result = await generator.generate("/test");

    expect(result.updated).toBe(true);
    expect(writeFile).toHaveBeenCalled();
  });

  it("writes to .kalp/generated/project.d.ts path", async () => {
    mockConfig([], {});
    vi.mocked(readFile).mockRejectedValue(new Error("ENOENT"));

    await generator.generate("/test");

    expect(writeFile).toHaveBeenCalledWith(
      expect.stringContaining("project.d.ts"),
      expect.any(String),
      "utf-8",
    );
  });

  it("generates readonly [] for empty secrets array", async () => {
    mockConfig([], { tier1: {} });
    vi.mocked(readFile).mockRejectedValue(new Error("ENOENT"));

    await generator.generate("/test");

    const writtenContent = vi.mocked(writeFile).mock.calls[0]![1] as string;
    expect(writtenContent).toContain("readonly []");
    expect(writtenContent).toContain('readonly ["tier1"]');
  });

  it("generates readonly [] for empty model tier keys", async () => {
    mockConfig(["S1"], {});
    vi.mocked(readFile).mockRejectedValue(new Error("ENOENT"));

    await generator.generate("/test");

    const writtenContent = vi.mocked(writeFile).mock.calls[0]![1] as string;
    expect(writtenContent).toContain('readonly ["S1"]');
    expect(writtenContent).toContain("readonly []");
  });

  it("generates both as readonly [] when both are empty", async () => {
    mockConfig([], {});
    vi.mocked(readFile).mockRejectedValue(new Error("ENOENT"));

    await generator.generate("/test");

    const writtenContent = vi.mocked(writeFile).mock.calls[0]![1] as string;
    expect(writtenContent).toContain(
      "export type RegisteredSecretKeys = readonly []",
    );
    expect(writtenContent).toContain(
      "export type ConfiguredAIModelTiers = readonly []",
    );
  });

  it("sorts secrets alphabetically", async () => {
    mockConfig(["Z_SECRET", "A_SECRET", "M_SECRET"], {});
    vi.mocked(readFile).mockRejectedValue(new Error("ENOENT"));

    await generator.generate("/test");

    const writtenContent = vi.mocked(writeFile).mock.calls[0]![1] as string;
    expect(writtenContent).toContain(
      'readonly ["A_SECRET", "M_SECRET", "Z_SECRET"]',
    );
  });

  it("sorts model tier keys alphabetically", async () => {
    mockConfig([], { zebra: {}, apple: {}, mango: {} });
    vi.mocked(readFile).mockRejectedValue(new Error("ENOENT"));

    await generator.generate("/test");

    const writtenContent = vi.mocked(writeFile).mock.calls[0]![1] as string;
    expect(writtenContent).toContain('readonly ["apple", "mango", "zebra"]');
  });

  it("handles non-array secrets gracefully (returns empty)", async () => {
    mockConfig("not-an-array", { tier: {} });
    vi.mocked(readFile).mockRejectedValue(new Error("ENOENT"));

    await generator.generate("/test");

    const writtenContent = vi.mocked(writeFile).mock.calls[0]![1] as string;
    expect(writtenContent).toContain(
      "export type RegisteredSecretKeys = readonly []",
    );
    expect(writtenContent).toContain('readonly ["tier"]');
  });

  it("handles non-object models gracefully (returns empty)", async () => {
    mockConfig(["S1"], "not-an-object");
    vi.mocked(readFile).mockRejectedValue(new Error("ENOENT"));

    await generator.generate("/test");

    const writtenContent = vi.mocked(writeFile).mock.calls[0]![1] as string;
    expect(writtenContent).toContain('readonly ["S1"]');
    expect(writtenContent).toContain(
      "export type ConfiguredAIModelTiers = readonly []",
    );
  });

  it("handles missing ai config in raw config", async () => {
    vi.mocked(loadProjectConfig).mockResolvedValue({
      path: "/test/kalp.config.ts",
      raw: { secrets: [] },
    });
    vi.mocked(readFile).mockRejectedValue(new Error("ENOENT"));

    await generator.generate("/test");

    const writtenContent = vi.mocked(writeFile).mock.calls[0]![1] as string;
    expect(writtenContent).toContain(
      "export type ConfiguredAIModelTiers = readonly []",
    );
  });

  it("includes the generated header comment", async () => {
    mockConfig([], {});
    vi.mocked(readFile).mockRejectedValue(new Error("ENOENT"));

    await generator.generate("/test");

    const writtenContent = vi.mocked(writeFile).mock.calls[0]![1] as string;
    expect(writtenContent).toContain("Kalp Generated Types");
    expect(writtenContent).toContain("This file is auto-generated");
  });

  it("includes module augmentation for @kalphq/sdk", async () => {
    mockConfig(["KEY1"], { tierA: {} });
    vi.mocked(readFile).mockRejectedValue(new Error("ENOENT"));

    await generator.generate("/test");

    const writtenContent = vi.mocked(writeFile).mock.calls[0]![1] as string;
    expect(writtenContent).toContain('declare module "@kalphq/sdk"');
    expect(writtenContent).toContain("interface SecretsRegistry");
    expect(writtenContent).toContain("interface KalpAITierRegistry");
  });

  it("creates generated directory before writing", async () => {
    mockConfig([], {});
    vi.mocked(readFile).mockRejectedValue(new Error("ENOENT"));

    await generator.generate("/test");

    expect(mkdir).toHaveBeenCalledWith(expect.stringContaining("generated"), {
      recursive: true,
    });
  });
});

describe("generateTypes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates generator and calls generate", async () => {
    vi.mocked(loadProjectConfig).mockResolvedValue({
      path: "/test/kalp.config.ts",
      raw: { secrets: [], ai: { models: {} } },
    });
    vi.mocked(mkdir).mockResolvedValue(undefined);
    vi.mocked(writeFile).mockResolvedValue(undefined);
    vi.mocked(readFile).mockRejectedValue(new Error("ENOENT"));

    await generateTypes("/test");

    expect(writeFile).toHaveBeenCalled();
    expect(vi.mocked(writeFile).mock.calls[0]![0]).toContain("project.d.ts");
  });
});
