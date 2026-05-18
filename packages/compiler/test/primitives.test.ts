import { describe, it, expect, beforeAll } from "vitest";
import { buildAgent } from "../src/compiler";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { executeBundleFromCode, readCompiledArtifacts } from "./test-helpers";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, "fixtures");
const OUT_DIR = path.join(__dirname, "dist");

describe("Primitives Fixture", () => {
  beforeAll(() => {
    if (fs.existsSync(OUT_DIR)) {
      fs.rmSync(OUT_DIR, { recursive: true });
    }
    fs.mkdirSync(OUT_DIR, { recursive: true });
  });

  it("should compile agent with date and math tools", async () => {
    const entry = path.join(FIXTURES_DIR, "primitives-agent.ts");
    const outDir = path.join(OUT_DIR, "primitives");
    await buildAgent(entry, outDir);

    const { semanticIr } = readCompiledArtifacts(outDir);
    expect(semanticIr.agent.name).toBe("primitives-test-agent");
    expect(Object.values(semanticIr.nodes).some((node) => node.stableName === "tool.date_tool")).toBe(true);
    expect(Object.values(semanticIr.nodes).some((node) => node.stableName === "tool.math_tool")).toBe(true);
    expect(Object.values(semanticIr.nodes).some((node) => node.stableName === "route.get.api.primitives")).toBe(true);
  });

  it("should execute primitive-based handlers", async () => {
    const entry = path.join(FIXTURES_DIR, "primitives-agent.ts");
    const outDir = path.join(OUT_DIR, "primitives-exec");
    await buildAgent(entry, outDir);

    const { semanticIr, bundleManifest, bundles } = readCompiledArtifacts(outDir);
    const mathEntry = Object.entries(semanticIr.nodes).find(
      ([, node]) => node.stableName === "tool.math_tool",
    );
    expect(mathEntry).toBeDefined();

    const [nodeId] = mathEntry!;
    const binding = bundleManifest.targets.default!.nodes[nodeId]!;
    const mathHandler = await executeBundleFromCode(bundles[binding.bundle]!);
    const mathResult = (await mathHandler(
      { value: 3.7 },
      {},
    )) as { rounded: number; random: number };
    expect(mathResult.rounded).toBe(4);
    expect(typeof mathResult.random).toBe("number");
  });
});
