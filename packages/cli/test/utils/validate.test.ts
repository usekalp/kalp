import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@kalphq/compiler", () => ({
  validateIR: vi.fn(),
  validateIRBindings: vi.fn(),
  calculateSemanticHash: vi.fn(),
  calculateArtifactHash: vi.fn(),
  calculateDeploymentHash: vi.fn(),
  analyzeHandler: vi.fn(),
}));

import {
  validateIR,
  validateIRBindings,
  calculateSemanticHash,
  calculateArtifactHash,
  calculateDeploymentHash,
  analyzeHandler,
} from "@kalphq/compiler";
import { validateCompiledIR } from "@/utils/validate";
import type { AgentManifestV3 } from "@/utils/manifest/types";
import type { BundleTargetManifest, ArtifactTargetManifest, BundleManifest, ArtifactManifest } from "@kalphq/sdk";

function makeManifest(overrides: Partial<AgentManifestV3> = {}): AgentManifestV3 {
  return {
    format: "kalp-agent-manifest",
    schemaVersion: 3,
    semanticIr: {
      schemaVersion: 3,
      agent: { name: "test-agent" },
      nodes: {},
    },
    schemas: {},
    bundleManifest: {
      targets: {
        default: { nodes: {}, abiVersion: 1, size: 0, sha256: "" } as unknown as BundleTargetManifest,
      },
    } as unknown as BundleManifest,
    artifactManifest: {
      targets: {
        default: { abiVersion: 1, size: 0, sha256: "" } as unknown as ArtifactTargetManifest,
      },
    } as unknown as ArtifactManifest,
    bundles: {
      "handler-a": {
        code: 'export default function() { return "ok"; }',
        file: "handler-a.js",
        size: 100,
        sha256: "abc123",
      },
    },
    sourceMetadata: undefined,
    metadata: undefined,
    ...overrides,
  };
}

function setupPassingMocks() {
  vi.mocked(validateIR).mockReturnValue({ valid: true, errors: [] });
  vi.mocked(validateIRBindings).mockReturnValue({ valid: true, errors: [] });
  vi.mocked(calculateSemanticHash).mockReturnValue("semantic-hash");
  vi.mocked(calculateArtifactHash).mockReturnValue("artifact-hash");
  vi.mocked(calculateDeploymentHash).mockReturnValue("correct-hash");
  vi.mocked(analyzeHandler).mockReturnValue({
    capabilities: ["network"],
    imports: { external: [], internal: [] },
    blockers: [],
    warnings: [],
  });
}

describe("validateCompiledIR", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns ok: true with analysis when everything passes", () => {
    setupPassingMocks();
    const manifest = makeManifest();

    const result = validateCompiledIR({
      agentName: "test-agent",
      manifest,
      hash: "correct-hash",
    });

    expect(result.ok).toBe(true);
    expect(result.analysis).toBeDefined();
    expect(result.analysis).toHaveLength(1);
    expect(result.analysis![0]!.name).toBe("handler-a");
  });

  it("fails at ir phase when validateIR returns invalid", () => {
    vi.mocked(validateIR).mockReturnValue({
      valid: false,
      errors: ["IR must be a valid JSON object."],
    });

    const result = validateCompiledIR({
      agentName: "test-agent",
      manifest: makeManifest(),
      hash: "any-hash",
    });

    expect(result.ok).toBe(false);
    expect(result.phase).toBe("ir");
    expect(result.errors).toEqual(["IR must be a valid JSON object."]);
  });

  it("fails when bundle target manifest is missing", () => {
    setupPassingMocks();
    const manifest = makeManifest();
    delete manifest.bundleManifest.targets.default;

    const result = validateCompiledIR({
      agentName: "test-agent",
      manifest,
      hash: "any-hash",
    });

    expect(result.ok).toBe(false);
    expect(result.phase).toBe("bindings");
    expect(result.errors).toContain('Missing bundle target manifest for "default"');
  });

  it("fails at bindings phase when validateIRBindings returns invalid", () => {
    vi.mocked(validateIR).mockReturnValue({ valid: true, errors: [] });
    vi.mocked(validateIRBindings).mockReturnValue({
      valid: false,
      errors: ["Bundle mapping missing for node n1"],
    });

    const result = validateCompiledIR({
      agentName: "test-agent",
      manifest: makeManifest(),
      hash: "any-hash",
    });

    expect(result.ok).toBe(false);
    expect(result.phase).toBe("bindings");
    expect(result.errors).toEqual(["Bundle mapping missing for node n1"]);
  });

  it("fails at hash phase when deployment hash mismatches", () => {
    vi.mocked(validateIR).mockReturnValue({ valid: true, errors: [] });
    vi.mocked(validateIRBindings).mockReturnValue({ valid: true, errors: [] });
    vi.mocked(calculateSemanticHash).mockReturnValue("semantic-hash");
    vi.mocked(calculateArtifactHash).mockReturnValue("artifact-hash");
    vi.mocked(calculateDeploymentHash).mockReturnValue("computed-hash");

    const result = validateCompiledIR({
      agentName: "test-agent",
      manifest: makeManifest(),
      hash: "client-provided-hash",
    });

    expect(result.ok).toBe(false);
    expect(result.phase).toBe("hash");
    expect(result.errors![0]).toContain("Hash mismatch");
    expect(result.errors![0]).toContain("client-provided-hash");
    expect(result.errors![0]).toContain("computed-hash");
  });

  it("fails at analysis phase when bundles have blockers", () => {
    vi.mocked(validateIR).mockReturnValue({ valid: true, errors: [] });
    vi.mocked(validateIRBindings).mockReturnValue({ valid: true, errors: [] });
    vi.mocked(calculateSemanticHash).mockReturnValue("semantic-hash");
    vi.mocked(calculateArtifactHash).mockReturnValue("artifact-hash");
    vi.mocked(calculateDeploymentHash).mockReturnValue("correct-hash");
    vi.mocked(analyzeHandler).mockReturnValue({
      capabilities: [],
      imports: { external: [], internal: [] },
      blockers: ["Use of 'eval' is prohibited for security reasons."],
      warnings: [],
    });

    const result = validateCompiledIR({
      agentName: "test-agent",
      manifest: makeManifest(),
      hash: "correct-hash",
    });

    expect(result.ok).toBe(false);
    expect(result.phase).toBe("analysis");
    expect(result.blockers).toBeDefined();
    expect(result.blockers![0]).toContain("in handler-a");
    expect(result.analysis).toBeDefined();
  });

  it("returns ok: true when analysis has warnings but no blockers", () => {
    vi.mocked(validateIR).mockReturnValue({ valid: true, errors: [] });
    vi.mocked(validateIRBindings).mockReturnValue({ valid: true, errors: [] });
    vi.mocked(calculateSemanticHash).mockReturnValue("semantic-hash");
    vi.mocked(calculateArtifactHash).mockReturnValue("artifact-hash");
    vi.mocked(calculateDeploymentHash).mockReturnValue("correct-hash");
    vi.mocked(analyzeHandler).mockReturnValue({
      capabilities: ["network"],
      imports: { external: [], internal: [] },
      blockers: [],
      warnings: ["Direct use of 'fetch' found."],
    });

    const result = validateCompiledIR({
      agentName: "test-agent",
      manifest: makeManifest(),
      hash: "correct-hash",
    });

    expect(result.ok).toBe(true);
    expect(result.analysis).toBeDefined();
    expect(result.analysis![0]!.warnings).toContain("Direct use of 'fetch' found.");
  });

  it("returns empty analysis array when bundles are empty", () => {
    setupPassingMocks();
    const manifest = makeManifest({ bundles: {} });

    const result = validateCompiledIR({
      agentName: "test-agent",
      manifest,
      hash: "correct-hash",
    });

    expect(result.ok).toBe(true);
    expect(result.analysis).toEqual([]);
  });

  it("analyzes multiple bundles independently", () => {
    vi.mocked(validateIR).mockReturnValue({ valid: true, errors: [] });
    vi.mocked(validateIRBindings).mockReturnValue({ valid: true, errors: [] });
    vi.mocked(calculateSemanticHash).mockReturnValue("semantic-hash");
    vi.mocked(calculateArtifactHash).mockReturnValue("artifact-hash");
    vi.mocked(calculateDeploymentHash).mockReturnValue("correct-hash");
    vi.mocked(analyzeHandler)
      .mockReturnValueOnce({
        capabilities: ["network"],
        imports: { external: [], internal: [] },
        blockers: [],
        warnings: [],
      })
      .mockReturnValueOnce({
        capabilities: ["timers"],
        imports: { external: [], internal: [] },
        blockers: [],
        warnings: [],
      });

    const manifest = makeManifest({
      bundles: {
        "handler-a": { code: "a", file: "a.js", size: 1, sha256: "a1" },
        "handler-b": { code: "b", file: "b.js", size: 1, sha256: "b1" },
      },
    });

    const result = validateCompiledIR({
      agentName: "test-agent",
      manifest,
      hash: "correct-hash",
    });

    expect(result.ok).toBe(true);
    expect(result.analysis).toHaveLength(2);
    expect(result.analysis![0]!.name).toBe("handler-a");
    expect(result.analysis![0]!.capabilities).toEqual(["network"]);
    expect(result.analysis![1]!.name).toBe("handler-b");
    expect(result.analysis![1]!.capabilities).toEqual(["timers"]);
  });

  it("uses custom target parameter instead of default", () => {
    setupPassingMocks();
    const manifest = makeManifest();
    manifest.bundleManifest.targets["staging"] = {
      nodes: {},
      abiVersion: 1,
      size: 0,
      sha256: "",
    } as unknown as BundleTargetManifest;

    const result = validateCompiledIR({
      agentName: "test-agent",
      manifest,
      hash: "correct-hash",
      target: "staging",
    });

    expect(result.ok).toBe(true);
  });

  it("fails when custom target does not exist in bundle manifest", () => {
    setupPassingMocks();

    const result = validateCompiledIR({
      agentName: "test-agent",
      manifest: makeManifest(),
      hash: "correct-hash",
      target: "nonexistent",
    });

    expect(result.ok).toBe(false);
    expect(result.phase).toBe("bindings");
    expect(result.errors![0]).toContain("Missing bundle target manifest for \"nonexistent\"");
  });
});
