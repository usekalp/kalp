import { describe, it, expect, beforeAll } from "vitest";
import { buildAgent } from "../src/compiler";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { executeBundleFromCode, readCompiledArtifacts } from "./test-helpers";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, "fixtures");
const OUT_DIR = path.join(__dirname, "dist");

function getNodeByStableName(
  semanticIr: ReturnType<typeof readCompiledArtifacts>["semanticIr"],
  stableName: string,
) {
  const nodeEntry = Object.entries(semanticIr.nodes).find(([, node]) => node.stableName === stableName);
  if (!nodeEntry) {
    throw new Error(`Node with stableName "${stableName}" not found`);
  }
  return { nodeId: nodeEntry[0], node: nodeEntry[1] };
}

describe("Compiler E2E", () => {
  beforeAll(() => {
    if (fs.existsSync(OUT_DIR)) {
      fs.rmSync(OUT_DIR, { recursive: true });
    }
    fs.mkdirSync(OUT_DIR, { recursive: true });
  });

  it("should compile the vNext artifact graph", async () => {
    const entry = path.join(FIXTURES_DIR, "basic-agent.ts");
    await buildAgent(entry, OUT_DIR);

    const { artifactManifest, semanticIr, schemas, bundleManifest } = readCompiledArtifacts(OUT_DIR);

    expect(semanticIr.schemaVersion).toBe(3);
    expect(artifactManifest.semanticHash).toBeTruthy();
    expect(semanticIr.agent.name).toBe("test-agent");
    expect(semanticIr.agent.stateSchema).toBeTruthy();
    expect(schemas[semanticIr.agent.stateSchema!]?.type).toBe("json-schema");

    expect(getNodeByStableName(semanticIr, "tool.summarize_tool").node.kind).toBe("tool");
    expect(getNodeByStableName(semanticIr, "listener.approval_requested").node.kind).toBe("listener");
    expect(getNodeByStableName(semanticIr, "contract.sales-agent").node.kind).toBe("contract");
    expect(getNodeByStableName(semanticIr, "route.get.health").node.kind).toBe("route");
    expect(getNodeByStableName(semanticIr, "hook.message").node.kind).toBe("message");
    expect(getNodeByStableName(semanticIr, "hook.init.0").node.kind).toBe("init");
    expect(getNodeByStableName(semanticIr, "cron.0").node.kind).toBe("cron");

    const nodeIds = Object.keys(semanticIr.nodes);
    expect(nodeIds.every((nodeId) => nodeId.startsWith("node_"))).toBe(true);
    expect(
      Object.values(semanticIr.nodes).every((node) => !("bundle" in node)),
    ).toBe(true);
    expect(bundleManifest.targets.default).toBeDefined();
  });

  it("should produce executable isolated bundles", async () => {
    const { semanticIr, bundleManifest, bundles } = readCompiledArtifacts(OUT_DIR);

    const toolNode = getNodeByStableName(semanticIr, "tool.summarize_tool");
    const toolBinding = bundleManifest.targets.default!.nodes[toolNode.nodeId]!;
    const toolHandler = await executeBundleFromCode(bundles[toolBinding.bundle]!);
    const toolResult = await toolHandler({ text: "test" }, {});
    expect(toolResult).toEqual({ summary: "TEST" });

    const messageNode = getNodeByStableName(semanticIr, "hook.message");
    const messageBinding = bundleManifest.targets.default!.nodes[messageNode.nodeId]!;
    const messageHandler = await executeBundleFromCode(bundles[messageBinding.bundle]!);
    const messageResult = await messageHandler(
      { text: "hello" },
      {
        actions: {
          run: async () => ({ summary: "HELLO" }),
          emit: async () => ({ approved: true }),
        },
      },
    );
    expect(messageResult).toEqual({ text: "HELLO" });

    const routeNode = getNodeByStableName(semanticIr, "route.get.health");
    const routeBinding = bundleManifest.targets.default!.nodes[routeNode.nodeId]!;
    const routeHandler = await executeBundleFromCode(bundles[routeBinding.bundle]!);
    const routeResult = await routeHandler({
      req: {},
      res: { json: () => {}, status: () => ({ json: () => {} }) },
      body: undefined,
      ctx: {},
    });
    expect(routeResult).toEqual({ status: "ok" });

    const contractNode = getNodeByStableName(semanticIr, "contract.sales-agent");
    const contractBinding = bundleManifest.targets.default!.nodes[contractNode.nodeId]!;
    const contractHandler = await executeBundleFromCode(bundles[contractBinding.bundle]!);
    const contractResult = await contractHandler({ query: "deal" }, {});
    expect(contractResult).toEqual({ result: "DEAL" });
  });

  it("should throw on ID collisions", async () => {
    const entry = path.join(FIXTURES_DIR, "duplicate-steps.ts");
    await expect(buildAgent(entry, path.join(OUT_DIR, "dup"))).rejects.toThrow(/collision|Duplicate node id/i);
  });

  it("should maintain registry isolation", async () => {
    const entry1 = path.join(FIXTURES_DIR, "agent1.ts");
    const entry2 = path.join(FIXTURES_DIR, "agent2.ts");
    const out1 = path.join(OUT_DIR, "iso1");
    const out2 = path.join(OUT_DIR, "iso2");

    await buildAgent(entry1, out1);
    const ir1 = readCompiledArtifacts(out1).semanticIr;
    expect(Object.values(ir1.nodes).some((node) => node.stableName === "tool.tool_a")).toBe(true);
    expect(Object.values(ir1.nodes).some((node) => node.stableName === "tool.tool_b")).toBe(false);

    await buildAgent(entry2, out2);
    const ir2 = readCompiledArtifacts(out2).semanticIr;
    expect(Object.values(ir2.nodes).some((node) => node.stableName === "tool.tool_b")).toBe(true);
    expect(Object.values(ir2.nodes).some((node) => node.stableName === "tool.tool_a")).toBe(false);
  });

  it("should generate deterministic semantic hashes", async () => {
    const entry = path.join(FIXTURES_DIR, "basic-agent.ts");
    const outA = path.join(OUT_DIR, "hashA");
    const outB = path.join(OUT_DIR, "hashB");
    await buildAgent(entry, outA);
    await buildAgent(entry, outB);
    const hashA = readCompiledArtifacts(outA).artifactManifest.semanticHash;
    const hashB = readCompiledArtifacts(outB).artifactManifest.semanticHash;
    expect(hashA).toBe(hashB);
  });
});

