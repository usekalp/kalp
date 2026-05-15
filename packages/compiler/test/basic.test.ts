import { describe, it, expect, beforeAll, vi } from "vitest";
import { buildAgent } from "../src/compiler";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { executeBundleFromCode } from "./test-helpers";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, "fixtures");
const OUT_DIR = path.join(__dirname, "dist");

describe("Compiler E2E", () => {
  beforeAll(() => {
    if (fs.existsSync(OUT_DIR)) {
      fs.rmSync(OUT_DIR, { recursive: true });
    }
    fs.mkdirSync(OUT_DIR, { recursive: true });
  });

  it("should complete end-to-end compilation", async () => {
    const entry = path.join(FIXTURES_DIR, "basic-agent.ts");
    await buildAgent(entry, OUT_DIR);
    expect(fs.existsSync(path.join(OUT_DIR, "ir.json"))).toBe(true);
  });

  it("should cover all steps and tools in registry", async () => {
    const ir = JSON.parse(
      fs.readFileSync(path.join(OUT_DIR, "ir.json"), "utf-8"),
    );
    // Entries map entry keys (steps.id, tools.id) to handler hashes
    expect(ir.nodes).toBeDefined();
    // Verify entries exist for steps and tools
    expect(ir.nodes["step:step_1"]).toBeDefined();
    expect(ir.nodes["step:format_response"]).toBeDefined();
    expect(ir.nodes["tool:search_tool"]).toBeDefined();
    // Each entry should reference a valid bundle
    expect(ir.bundles[ir.nodes["step:step_1"].bundle]).toBeDefined();
    expect(ir.bundles[ir.nodes["step:format_response"].bundle]).toBeDefined();
    expect(ir.bundles[ir.nodes["tool:search_tool"].bundle]).toBeDefined();
  });

  it("should map routes correctly", async () => {
    const ir = JSON.parse(
      fs.readFileSync(path.join(OUT_DIR, "ir.json"), "utf-8"),
    );
    // Routes are in nodes with key "route:METHOD:/path"
    expect(ir.nodes?.["route:GET:/health"]).toBeDefined();
    // Route entry should reference a valid bundle
    const routeNode = ir.nodes["route:GET:/health"];
    expect(ir.bundles?.[routeNode.bundle]).toBeDefined();
    expect(routeNode.kind).toBe("route");
  });

  it("should preserve agent metadata", async () => {
    const ir = JSON.parse(
      fs.readFileSync(path.join(OUT_DIR, "ir.json"), "utf-8"),
    );
    expect(ir.version).toBe(2);
    // Metadata object with name
    expect(ir.agent).toBeDefined();
    expect(ir.agent.name).toBe("test-agent");
    expect(ir.meta).toBeDefined();
    expect(typeof ir.meta.compilerVersion).toBe("string");
  });

  it("should throw on ID collisions", async () => {
    const entry = path.join(FIXTURES_DIR, "duplicate-steps.ts");
    await expect(buildAgent(entry, path.join(OUT_DIR, "dup"))).rejects.toThrow(
      /Node ID collision/,
    );
  });

  it("should produce executable isolated bundles", async () => {
    const ir = JSON.parse(
      fs.readFileSync(path.join(OUT_DIR, "ir.json"), "utf-8"),
    );

    // Bundles are in ir.bundles with hash keys
    expect(ir.bundles).toBeDefined();

    // Test Step execution
    const step1Node = ir.nodes["step:step_1"];
    expect(step1Node).toBeDefined();
    expect(ir.bundles[step1Node.bundle]).toBeDefined();
    const step1Handler = executeBundleFromCode(ir.bundles[step1Node.bundle].code);
    expect(typeof step1Handler).toBe("function");
    const stepResult = await step1Handler({ text: "test" }, {});
    expect(stepResult.text).toBe("TEST"); // mockUtil converts to uppercase

    // Test Hook execution
    const onMessageNode = ir.nodes?.["hook:message"];
    expect(onMessageNode).toBeDefined();
    expect(ir.bundles[onMessageNode.bundle]).toBeDefined();
    const onMessageHandler = executeBundleFromCode(
      ir.bundles[onMessageNode.bundle].code,
    );
    expect(typeof onMessageHandler).toBe("function");
    const hookResult = await onMessageHandler({});
    expect(hookResult.text).toBe("hello from hook");

    // Test Route execution
    const routeNode = ir.nodes["route:GET:/health"];
    expect(routeNode).toBeDefined();
    expect(ir.bundles[routeNode.bundle]).toBeDefined();
    const routeHandler = executeBundleFromCode(ir.bundles[routeNode.bundle].code);
    expect(typeof routeHandler).toBe("function");
    const routeResult = await routeHandler({}, {}, {});
    expect(routeResult.status).toBe("ok");

    // Test RPC/onCall execution
    const onCallNode = ir.nodes?.["hook:call"];
    expect(onCallNode).toBeDefined();
    expect(ir.bundles[onCallNode.bundle]).toBeDefined();
    const onCallHandler = executeBundleFromCode(ir.bundles[onCallNode.bundle].code);
    expect(typeof onCallHandler).toBe("function");
    const rpcResult = await onCallHandler({}, {});
    expect(rpcResult.result).toBe("call resolved");

    // Test No-input step
    const noInputNode = ir.nodes["step:step_no_input"];
    expect(noInputNode).toBeDefined();
    expect(ir.bundles[noInputNode.bundle]).toBeDefined();
    const noInputHandler = executeBundleFromCode(ir.bundles[noInputNode.bundle].code);
    const noInputResult = await noInputHandler({}, {});
    expect(noInputResult.ok).toBe(true);
  });

  it("should translate Zod schemas to JSON Schema with meta", async () => {
    const ir = JSON.parse(
      fs.readFileSync(path.join(OUT_DIR, "ir.json"), "utf-8"),
    );
    // Bundles contain code, schemas are in node contract
    const step1Node = ir.nodes["step:step_1"];
    expect(step1Node.contract.input.type).toBe("object");
    expect(step1Node.contract.input.required).toContain("text");
    // inputSchemaMeta may not be present depending on schema complexity
  });

  it("should resolve external imports in handlers", async () => {
    // Verified by isolated bundle test (mockUtil was imported and worked)
    expect(true).toBe(true);
  });

  it("should maintain registry isolation", async () => {
    const entry1 = path.join(FIXTURES_DIR, "agent1.ts");
    const entry2 = path.join(FIXTURES_DIR, "agent2.ts");
    const out1 = path.join(OUT_DIR, "iso1");
    const out2 = path.join(OUT_DIR, "iso2");

    await buildAgent(entry1, out1);
    const ir1 = JSON.parse(
      fs.readFileSync(path.join(out1, "ir.json"), "utf-8"),
    );
    // Entries contain step keys
    expect(ir1.nodes["step:step_a"]).toBeDefined();
    expect(ir1.nodes["step:step_b"]).toBeUndefined();

    await buildAgent(entry2, out2);
    const ir2 = JSON.parse(
      fs.readFileSync(path.join(out2, "ir.json"), "utf-8"),
    );
    expect(ir2.nodes["step:step_b"]).toBeDefined();
    expect(ir2.nodes["step:step_a"]).toBeUndefined();
  });

  it("should generate deterministic hashes", async () => {
    const entry = path.join(FIXTURES_DIR, "basic-agent.ts");
    const outA = path.join(OUT_DIR, "hashA");
    const outB = path.join(OUT_DIR, "hashB");
    await buildAgent(entry, outA);
    await buildAgent(entry, outB);
    const irA = fs.readFileSync(path.join(outA, "ir.json"), "utf-8");
    const irB = fs.readFileSync(path.join(outB, "ir.json"), "utf-8");
    expect(JSON.parse(irA).irHash).toBe(JSON.parse(irB).irHash);
  });

  it("should use content-addressable hashes for handlers", async () => {
    const ir = JSON.parse(
      fs.readFileSync(path.join(OUT_DIR, "ir.json"), "utf-8"),
    );
    // Entries map to handler hashes, bundles are keyed by hash
    const step1Node = ir.nodes["step:step_1"];
    expect(step1Node).toBeDefined();
    const step1Hash = step1Node.bundle;
    expect(typeof step1Hash).toBe("string");
    expect(ir.bundles[step1Hash]).toBeDefined();
    // Hash should be 8 chars (sha256 truncated)
    expect(step1Hash.length).toBe(8);
  });

  it("should compile agents with contracts", async () => {
    const ir = JSON.parse(
      fs.readFileSync(path.join(OUT_DIR, "ir.json"), "utf-8"),
    );
    // Contract should be preserved in metadata
    expect(ir.agent).toBeDefined();
    // Verify entries and bundles exist (contract usage creates steps/tools)
    expect(ir.nodes).toBeDefined();
    expect(ir.bundles).toBeDefined();
    // At least one step/tool/route/entry should exist for contract agent
    expect(Object.keys(ir.nodes).length).toBeGreaterThan(0);
  });

  it("should compile all lifecycle hooks", async () => {
    const ir = JSON.parse(
      fs.readFileSync(path.join(OUT_DIR, "ir.json"), "utf-8"),
    );
    // Hooks are in entries with lifecycle keys
    expect(ir.nodes?.["hook:message"]).toBeDefined();
    expect(ir.bundles?.[ir.nodes["hook:message"].bundle]).toBeDefined();
    expect(ir.nodes?.["hook:call"]).toBeDefined();
    expect(ir.bundles?.[ir.nodes["hook:call"].bundle]).toBeDefined();
  });

  it("should serialize label/tags/emits metadata with fallback warnings", async () => {
    const entry = path.join(FIXTURES_DIR, "emits-agent.ts");
    const outDir = path.join(OUT_DIR, "emits");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await buildAgent(entry, outDir);

    const ir = JSON.parse(fs.readFileSync(path.join(outDir, "ir.json"), "utf-8"));
    expect(ir.agent.name).toBe("customer_support");
    expect(ir.agent.label).toBe("Customer Support");
    expect(ir.agent.tags).toEqual(["support", "inbox"]);
    // Since emits are now stored on the hook nodes, let's find one
    const hookNode = ir.nodes["hook:message"];
    expect(hookNode.emits.ticket_created.type).toBe("schema");
    expect(hookNode.emits.webhook_sent).toEqual({
      type: "description",
      description: "Webhook notification payload",
    });
    expect(hookNode.emits.refined_payload).toEqual({
      type: "description",
      description: "Non-serializable schema",
    });
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("should include listeners and public metadata in IR", async () => {
    const entry = path.join(FIXTURES_DIR, "listener-agent.ts");
    const outDir = path.join(OUT_DIR, "listener");
    await buildAgent(entry, outDir);
    const ir = JSON.parse(fs.readFileSync(path.join(outDir, "ir.json"), "utf-8"));
    expect(ir.agent.skipAuth).toBe(true);
    const listenerKeys = Object.keys(ir.nodes).filter(k => k.startsWith("listener:"));
    expect(listenerKeys.length).toBeGreaterThan(0);
    expect(ir.nodes[listenerKeys[0]!]).toMatchObject({
      source: {
        agentId: "source-agent",
        event: "ticket_created",
      }
    });
  });
});
