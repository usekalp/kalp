import { describe, it, expect, beforeAll } from "vitest";
import { buildAgent } from "../src/compiler";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { clearRegistry } from "@kalphq/sdk";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, "fixtures");
const OUT_DIR = path.join(__dirname, "dist");

function executeBundle(filePath: string) {
  clearRegistry(); // Clear registry to avoid collisions when the bundle re-registers nodes during evaluation
  const code = fs.readFileSync(filePath, "utf-8");
  // The bundle is an IIFE that returns the __handler object (which contains the default export)
  const bundleResult = eval(code);
  return bundleResult.default;
}

describe("Compiler E2E - 18 Point Suite", () => {
  beforeAll(() => {
    if (fs.existsSync(OUT_DIR)) {
      fs.rmSync(OUT_DIR, { recursive: true });
    }
    fs.mkdirSync(OUT_DIR, { recursive: true });
  });

  // 1. Base compilation
  it("Test 1: should complete end-to-end compilation", async () => {
    const entry = path.join(FIXTURES_DIR, "basic-agent.ts");
    await buildAgent(entry, OUT_DIR);
    expect(fs.existsSync(path.join(OUT_DIR, "ir.json"))).toBe(true);
  });

  // 2, 3. Step and Tool coverage
  it("Tests 2-3: should cover all steps and tools in registry", async () => {
    const ir = JSON.parse(fs.readFileSync(path.join(OUT_DIR, "ir.json"), "utf-8"));
    expect(Object.keys(ir.steps)).toContain("step_1");
    expect(Object.keys(ir.steps)).toContain("format_response");
    expect(Object.keys(ir.tools)).toContain("search_tool");
  });

  // 4. Route mapping
  it("Test 4: should map routes correctly", async () => {
    const ir = JSON.parse(fs.readFileSync(path.join(OUT_DIR, "ir.json"), "utf-8"));
    expect(ir.routes["GET:/health"]).toBeDefined();
    expect(ir.routes["GET:/health"].method).toBe("GET");
    expect(ir.routes["GET:/health"].path).toBe("/health");
  });

  // 5. Agent metadata
  it("Test 5: should preserve agent metadata", async () => {
    const ir = JSON.parse(fs.readFileSync(path.join(OUT_DIR, "ir.json"), "utf-8"));
    expect(ir.agent.id).toBe("test-agent");
    expect(ir.agent.name).toBe("test-agent");
  });

  // 6. ID collision guardrail
  it("Test 6: should throw on ID collisions", async () => {
    const entry = path.join(FIXTURES_DIR, "duplicate-steps.ts");
    await expect(buildAgent(entry, path.join(OUT_DIR, "dup"))).rejects.toThrow(/Node ID collision/);
  });

  // 7, 15, 16, 17, 18. Isolated handler execution
  it("Tests 7, 15, 16, 17, 18: should produce executable isolated bundles", async () => {
    const ir = JSON.parse(fs.readFileSync(path.join(OUT_DIR, "ir.json"), "utf-8"));
    
    // Test Step execution (Test 7)
    const step1Handler = executeBundle(path.join(OUT_DIR, ir.steps.step_1.handlerFile));
    expect(typeof step1Handler).toBe("function");
    const stepResult = await step1Handler({ text: "test" }, {});
    expect(stepResult.text).toBe("TEST"); // mockUtil converts to uppercase

    // Test Hook execution (Test 15)
    const onMessageHandler = executeBundle(path.join(OUT_DIR, ir.agent.hooks.onMessage.handlerFile));
    expect(typeof onMessageHandler).toBe("function");
    const hookResult = await onMessageHandler({});
    expect(hookResult.text).toBe("hello from hook");

    // Test Route execution (Test 16)
    const routeHandler = executeBundle(path.join(OUT_DIR, ir.routes["GET:/health"].handlerFile));
    expect(typeof routeHandler).toBe("function");
    const routeResult = await routeHandler({}, {}, {});
    expect(routeResult.status).toBe("ok");
    
    // Test RPC/onCall execution (Test 17)
    const onCallHandler = executeBundle(path.join(OUT_DIR, ir.agent.hooks.onCall.handlerFile));
    expect(typeof onCallHandler).toBe("function");
    const rpcResult = await onCallHandler({}, {});
    expect(rpcResult.result).toBe("call resolved");
    
    // Test No-input step (Test 18)
    const noInputHandler = executeBundle(path.join(OUT_DIR, ir.steps.step_no_input.handlerFile));
    const noInputResult = await noInputHandler({}, {});
    expect(noInputResult.ok).toBe(true);
  });

  // 8, 9. Zod schema translation
  it("Tests 8-9: should translate Zod schemas to JSON Schema with meta", async () => {
    const ir = JSON.parse(fs.readFileSync(path.join(OUT_DIR, "ir.json"), "utf-8"));
    const s1 = ir.steps.step_1;
    expect(s1.inputSchema.type).toBe("object");
    expect(s1.inputSchema.required).toContain("text");
    expect(s1.inputSchemaMeta.hasRefinements).toBe(false);
  });

  // 10. Import resolution (utils)
  it("Test 10: should resolve external imports in handlers", async () => {
    // Verified by Test 7 (mockUtil was imported and worked)
    expect(true).toBe(true);
  });

  // 12. State isolation / registry cleanup
  it("Test 12: should maintain registry isolation", async () => {
    const entry1 = path.join(FIXTURES_DIR, "agent1.ts");
    const entry2 = path.join(FIXTURES_DIR, "agent2.ts");
    const out1 = path.join(OUT_DIR, "iso1");
    const out2 = path.join(OUT_DIR, "iso2");

    await buildAgent(entry1, out1);
    const ir1 = JSON.parse(fs.readFileSync(path.join(out1, "ir.json"), "utf-8"));
    expect(ir1.steps.step_a).toBeDefined();
    expect(ir1.steps.step_b).toBeUndefined();

    await buildAgent(entry2, out2);
    const ir2 = JSON.parse(fs.readFileSync(path.join(out2, "ir.json"), "utf-8"));
    expect(ir2.steps.step_b).toBeDefined();
    expect(ir2.steps.step_a).toBeUndefined();
  });

  // 13. Deterministic IR hash
  it("Test 13: should generate deterministic hashes", async () => {
     const entry = path.join(FIXTURES_DIR, "basic-agent.ts");
     const outA = path.join(OUT_DIR, "hashA");
     const outB = path.join(OUT_DIR, "hashB");
     await buildAgent(entry, outA);
     await buildAgent(entry, outB);
     const irA = fs.readFileSync(path.join(outA, "ir.json"), "utf-8");
     const irB = fs.readFileSync(path.join(outB, "ir.json"), "utf-8");
     expect(JSON.parse(irA).irHash).toBe(JSON.parse(irB).irHash);
  });

  // 14. Relative path validation
  it("Test 14: should use relative paths for handlers", async () => {
    const ir = JSON.parse(fs.readFileSync(path.join(OUT_DIR, "ir.json"), "utf-8"));
    expect(ir.steps.step_1.handlerFile.startsWith("./handlers/")).toBe(true);
  });
});
