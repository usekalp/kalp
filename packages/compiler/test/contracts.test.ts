import { describe, it, expect, beforeAll } from "vitest";
import { buildAgent } from "../src/compiler";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { executeBundleFromCode, readCompiledArtifacts } from "./test-helpers";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, "fixtures");
const OUT_DIR = path.join(__dirname, "dist");

describe("Contracts Fixture", () => {
  beforeAll(() => {
    if (fs.existsSync(OUT_DIR)) {
      fs.rmSync(OUT_DIR, { recursive: true });
    }
    fs.mkdirSync(OUT_DIR, { recursive: true });
  });

  it("should compile agent contracts into semantic nodes", async () => {
    const entry = path.join(FIXTURES_DIR, "contracts-agent.ts");
    const outDir = path.join(OUT_DIR, "contracts");
    await buildAgent(entry, outDir);

    const { semanticIr } = readCompiledArtifacts(outDir);
    expect(semanticIr.agent.name).toBe("contracts-test-agent");
    expect(
      Object.values(semanticIr.nodes).some((node) => node.stableName === "contract.approval-service"),
    ).toBe(true);
    expect(
      Object.values(semanticIr.nodes).some((node) => node.stableName === "route.post.api.contract"),
    ).toBe(true);
    expect(
      Object.values(semanticIr.nodes).some((node) => node.stableName === "hook.message"),
    ).toBe(true);
  });

  it("should execute contract handlers", async () => {
    const entry = path.join(FIXTURES_DIR, "contracts-agent.ts");
    const outDir = path.join(OUT_DIR, "contracts-exec");
    await buildAgent(entry, outDir);

    const { semanticIr, bundleManifest, bundles } = readCompiledArtifacts(outDir);
    const contractEntry = Object.entries(semanticIr.nodes).find(
      ([, node]) => node.stableName === "contract.approval-service",
    );
    expect(contractEntry).toBeDefined();

    const [nodeId] = contractEntry!;
    const binding = bundleManifest.targets.default!.nodes[nodeId]!;
    const contractHandler = await executeBundleFromCode(bundles[binding.bundle]!);
    const result = await contractHandler({ opportunityId: "opp_123" }, {});
    expect(result).toEqual({ approved: true });
  });
});

