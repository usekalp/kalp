import { describe, it, expect, vi, beforeEach } from "vitest";
import { join } from "node:path";

const { mockAccess, mockMkdtemp, mockRm, mockReadFile } = vi.hoisted(() => ({
  mockAccess: vi.fn(),
  mockMkdtemp: vi.fn(),
  mockRm: vi.fn(),
  mockReadFile: vi.fn(),
}));

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...actual,
    access: mockAccess,
    mkdtemp: mockMkdtemp,
    rm: mockRm,
    readFile: mockReadFile,
  };
});

vi.mock("@kalphq/compiler", () => ({
  buildAgent: vi.fn(),
}));

vi.mock("@/utils/ir/hashIR", () => ({
  computePushHash: vi.fn(),
}));

import { readAgentManifest } from "@/utils/manifest/index";
import { computePushHash } from "@/utils/ir/hashIR";
import { buildAgent } from "@kalphq/compiler";
import type { SourceMetadataManifest } from "@kalphq/compiler";
import type {
  AgentManifestV3,
  BundledArtifactFile,
} from "@/utils/manifest/types";

describe("manifest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("AgentManifestV3 type structure", () => {
    it("has correct format field", () => {
      const manifest: AgentManifestV3 = {
        format: "kalp-agent-manifest",
        schemaVersion: 3,
        artifactManifest: {
          semanticHash: "hash123",
          schemaVersion: 3,
          files: {},
          targets: { default: { deploymentHash: "deploy-hash" } },
        } as unknown as AgentManifestV3["artifactManifest"],
        semanticIr: {
          schemaVersion: 3,
          agent: { name: "test" },
          nodes: {},
          edges: [],
        } as unknown as AgentManifestV3["semanticIr"],
        schemas: { schemas: {} } as unknown as AgentManifestV3["schemas"],
        bundleManifest: {
          schemaVersion: 3,
          targets: { default: { nodes: {} } },
        } as unknown as AgentManifestV3["bundleManifest"],
        bundles: {},
      };

      expect(manifest.format).toBe("kalp-agent-manifest");
      expect(manifest.schemaVersion).toBe(3);
    });

    it("BundledArtifactFile has required fields", () => {
      const bundle: BundledArtifactFile = {
        file: "dist/bundle.js",
        code: "console.log('hello')",
        size: 1024,
        sha256: "abcdef1234567890",
      };

      expect(bundle.file).toBe("dist/bundle.js");
      expect(bundle.code).toBe("console.log('hello')");
      expect(bundle.size).toBe(1024);
      expect(bundle.sha256).toBe("abcdef1234567890");
    });

    it("manifest includes optional sourceMetadata", () => {
      const manifest: AgentManifestV3 = {
        format: "kalp-agent-manifest",
        schemaVersion: 3,
        artifactManifest: {
          semanticHash: "h",
          schemaVersion: 3,
          files: {},
          targets: { default: { deploymentHash: "d" } },
        } as unknown as AgentManifestV3["artifactManifest"],
        semanticIr: { schemaVersion: 3, agent: { name: "test" }, nodes: {} },
        schemas: { schemas: {} } as unknown as AgentManifestV3["schemas"],
        bundleManifest: {
          schemaVersion: 3,
          targets: { default: { nodes: {} } },
        } as unknown as AgentManifestV3["bundleManifest"],
        bundles: {},
        sourceMetadata: { sourceFiles: ["src/index.ts"] } as unknown as SourceMetadataManifest,
        metadata: { generatedAt: "2025-01-01T00:00:00Z" },
      };

      expect(manifest.sourceMetadata).toBeDefined();
      expect(manifest.metadata?.generatedAt).toBe("2025-01-01T00:00:00Z");
    });

    it("has bundles record of BundledArtifactFile", () => {
      const bundles: Record<string, BundledArtifactFile> = {
        agent: {
          file: "agent.js",
          code: "export default {}",
          size: 512,
          sha256: "sha-abc",
        },
        studio: {
          file: "studio.js",
          code: "export default {}",
          size: 2048,
          sha256: "sha-xyz",
        },
      };

      expect(Object.keys(bundles)).toHaveLength(2);
      expect(bundles.agent!.file).toBe("agent.js");
      expect(bundles.studio!.size).toBe(2048);
    });
  });

  describe("computePushHash", () => {
    it("returns deployment hash for default target", () => {
      vi.mocked(computePushHash).mockReturnValue("deployment-hash-123");

      const result = computePushHash(
        {
          artifactManifest: {
            targets: { default: { deploymentHash: "deployment-hash-123" } },
          },
        } as unknown as AgentManifestV3,
        "default",
      );
      expect(result).toBe("deployment-hash-123");
    });

    it("throws when target is missing", () => {
      vi.mocked(computePushHash).mockImplementation(() => {
        throw new Error('Missing deployment hash for target "nonexistent"');
      });

      expect(() =>
        computePushHash(
          {
            artifactManifest: {
              targets: { default: { deploymentHash: "d" } },
            },
          } as unknown as AgentManifestV3,
          "nonexistent",
        ),
      ).toThrow('Missing deployment hash for target "nonexistent"');
    });

    it("returns hash for custom target", () => {
      vi.mocked(computePushHash).mockReturnValue("custom-deploy-hash");

      const result = computePushHash(
        {
          artifactManifest: {
            targets: { custom: { deploymentHash: "custom-deploy-hash" } },
          },
        } as unknown as AgentManifestV3,
        "custom",
      );
      expect(result).toBe("custom-deploy-hash");
    });
  });

  describe("readAgentManifest", () => {
    beforeEach(() => {
      mockAccess.mockResolvedValue(undefined);
      mockMkdtemp.mockResolvedValue("/tmp/kalp-build-abc123");
      mockRm.mockResolvedValue(undefined);

      vi.mocked(buildAgent).mockImplementation(async () => {
        return {} as unknown as Awaited<ReturnType<typeof buildAgent>>;
      });

      mockReadFile.mockImplementation((filePath: string) => {
        const pathStr = filePath as string;
        if (pathStr.includes("artifact-manifest.json")) {
          return JSON.stringify({
            semanticHash: "sh-1",
            targets: { default: { deploymentHash: "dh-1" } },
          });
        }
        if (pathStr.includes("semantic-ir.json")) {
          return JSON.stringify({ nodes: [{ id: "n1" }] });
        }
        if (pathStr.includes("schemas.json")) {
          return JSON.stringify({ schemas: { MySchema: {} } });
        }
        if (pathStr.includes("bundle-manifest.json")) {
          return JSON.stringify({
            targets: {
              default: {
                nodes: {
                  main: {
                    bundle: "agent",
                    file: "./bundles/agent.js",
                    size: 512,
                    sha256: "abc",
                  },
                },
              },
            },
          });
        }
        if (pathStr.includes("bundles")) {
          return "export default {}";
        }
        throw new Error(`Unexpected readFile: ${pathStr}`);
      });
    });

    it("reads agent manifest files successfully", async () => {
      const manifest = await readAgentManifest({
        cwd: "/fake/project",
        agentName: "my-agent",
      });

      expect(manifest.format).toBe("kalp-agent-manifest");
      expect(manifest.schemaVersion).toBe(3);
      expect(manifest.artifactManifest.semanticHash).toBe("sh-1");
      expect(manifest.semanticIr.nodes).toHaveLength(1);
      expect(manifest.bundles).toBeDefined();
      expect(Object.keys(manifest.bundles)).toContain("agent");
      expect(manifest.metadata?.generatedAt).toBeDefined();
    });

    it("accesses the agent entrypoint path", async () => {
      await readAgentManifest({ cwd: "/proj", agentName: "hello" });

      const expectedPath = join("/proj", "agents", "hello", "index.ts");
      expect(mockAccess).toHaveBeenCalledWith(expectedPath);
    });

    it("compiles the agent using buildAgent", async () => {
      await readAgentManifest({ cwd: "/proj", agentName: "bot" });

      expect(buildAgent).toHaveBeenCalledTimes(1);
      const [agentPath, tempDir, cwd, opts] = (
        buildAgent as ReturnType<typeof vi.fn>
      ).mock.calls[0]!;
      expect(agentPath).toContain(join("agents", "bot", "index.ts"));
      expect(tempDir).toContain("kalp-build-");
      expect(cwd).toBe("/proj");
      expect(opts.includeDebug).toBe(false);
    });

    it("cleans up temp directory after reading", async () => {
      await readAgentManifest({ cwd: "/proj", agentName: "cleanup-test" });

      expect(mockRm).toHaveBeenCalledWith("/tmp/kalp-build-abc123", {
        recursive: true,
        force: true,
      });
    });

    it("cleans up even if compilation fails", async () => {
      vi.mocked(buildAgent).mockRejectedValueOnce(
        new Error("compilation error"),
      );

      await expect(
        readAgentManifest({ cwd: "/proj", agentName: "bad-agent" }),
      ).rejects.toThrow("compilation error");

      expect(mockRm).toHaveBeenCalledWith("/tmp/kalp-build-abc123", {
        recursive: true,
        force: true,
      });
    });

    it("reads bundle files from artifacts directory", async () => {
      await readAgentManifest({ cwd: "/proj", agentName: "bundle-agent" });

      const bundleReadCall = mockReadFile.mock.calls.find(
        (call: unknown[]) => call[0] && (call[0] as string).includes("bundles"),
      );
      expect(bundleReadCall).toBeDefined();
    });
  });
});
