import { describe, expect, it } from "vitest";
import { analyzeHandler } from "../src/analyze";

describe("analyzeHandler - capabilities", () => {
  it("detects ctx.actions.run", () => {
    const result = analyzeHandler(`
      async function handler(ctx) {
        await ctx.actions.run(step, { value: "x" });
      }
    `);
    expect(result.capabilities).toContain("actions.run");
  });

  it("detects ctx.storage.put", () => {
    const result = analyzeHandler(`
      async function handler(ctx) {
        await ctx.storage.put("key", "value");
      }
    `);
    expect(result.capabilities).toContain("storage.put");
  });

  it("detects ctx.ai.classify", () => {
    const result = analyzeHandler(`
      async function handler(ctx) {
        const label = await ctx.ai.classify({ input: "hello", labels: ["a","b"] });
      }
    `);
    expect(result.capabilities).toContain("ai.classify");
  });

  it("detects ctx.ai.generate", () => {
    const result = analyzeHandler(`
      async function handler(ctx) {
        const res = await ctx.ai.generate({ prompt: "hi", model: "openai/gpt-4o" });
      }
    `);
    expect(result.capabilities).toContain("ai.generate");
  });

  it("detects ctx.memory.search", () => {
    const result = analyzeHandler(`
      async function handler(ctx) {
        const items = await ctx.memory.search("query");
      }
    `);
    expect(result.capabilities).toContain("memory.search");
  });

  it("deduplicates capabilities", () => {
    const result = analyzeHandler(`
      async function handler(ctx) {
        await ctx.actions.run(a);
        await ctx.actions.run(b);
      }
    `);
    expect(result.capabilities.filter((c) => c === "actions.run")).toHaveLength(
      1,
    );
  });

  it("detects destructured parameter usage", () => {
    const result = analyzeHandler(`
      async function handler({ actions, ai }) {
        await actions.run(step, { value: "x" });
        await ai.classify({ input: "hi", labels: ["a", "b"] });
      }
    `);
    expect(result.capabilities).toContain("actions.run");
    expect(result.capabilities).toContain("ai.classify");
  });

  it("detects variable destructured usage", () => {
    const result = analyzeHandler(`
      async function handler(ctx) {
        const { storage } = ctx;
        await storage.put("key", "value");
      }
    `);
    expect(result.capabilities).toContain("storage.put");
  });

  it("detects actions.loop", () => {
    const result = analyzeHandler(`
      async function handler(ctx) {
        ctx.actions.loop(async () => {
          await ctx.actions.wait("1h");
        });
      }
    `);
    expect(result.capabilities).toContain("actions.loop");
  });

  it("detects actions.wait", () => {
    const result = analyzeHandler(`
      async function handler(ctx) {
        await ctx.actions.wait("30m");
      }
    `);
    expect(result.capabilities).toContain("actions.wait");
  });

  it("detects destructured actions.loop and actions.wait", () => {
    const result = analyzeHandler(`
      async function handler({ actions }) {
        actions.loop(async () => {
          await actions.wait("1h");
        });
      }
    `);
    expect(result.capabilities).toContain("actions.loop");
    expect(result.capabilities).toContain("actions.wait");
  });
});

describe("analyzeHandler - blockers", () => {
  it("detects eval()", () => {
    const result = analyzeHandler(`
      function bad() { eval("code"); }
    `);
    expect(result.blockers).toContain("eval()");
  });

  it("detects Function()", () => {
    const result = analyzeHandler(`
      const fn = Function("return 1");
    `);
    expect(result.blockers).toContain("Function()");
  });

  it("detects globalThis", () => {
    const result = analyzeHandler(`
      globalThis.fetch("https://example.com");
    `);
    expect(result.blockers).toContain("globalThis");
  });

  it("detects window", () => {
    const result = analyzeHandler(`
      window.location.href = "/";
    `);
    expect(result.blockers).toContain("window");
  });
});

describe("analyzeHandler - warnings", () => {
  it("detects setTimeout as warning", () => {
    const result = analyzeHandler(`
      function later() { setTimeout(() => {}, 1000); }
    `);
    expect(result.warnings).toContain("setTimeout()");
    expect(result.blockers).not.toContain("setTimeout()");
  });

  it("detects setInterval as warning", () => {
    const result = analyzeHandler(`
      setInterval(() => tick(), 5000);
    `);
    expect(result.warnings).toContain("setInterval()");
  });

  it("detects bare fetch() as warning", () => {
    const result = analyzeHandler(`
      async function handler() {
        const res = await fetch("https://api.example.com");
      }
    `);
    expect(result.warnings).toContain("fetch()");
  });

  it("does NOT flag ctx.actions.fetch as violation", () => {
    const result = analyzeHandler(`
      async function handler(ctx) {
        await ctx.actions.fetch("https://api.example.com");
      }
    `);
    expect(result.blockers).not.toContain("fetch()");
    expect(result.warnings).not.toContain("fetch()");
  });

  it("detects Math.random() as warning", () => {
    const result = analyzeHandler(`
      const x = Math.random();
    `);
    expect(result.warnings).toContain("Math.random()");
  });

  it("detects Date.now() as warning", () => {
    const result = analyzeHandler(`
      const t = Date.now();
    `);
    expect(result.warnings).toContain("Date.now()");
  });

  it("detects process.env as warning", () => {
    const result = analyzeHandler(`
      const key = process.env.API_KEY;
    `);
    expect(result.warnings).toContain("process.env");
  });

  it("detects new Date() as warning", () => {
    const result = analyzeHandler(`
      const now = new Date();
    `);
    expect(result.warnings).toContain("new Date()");
  });
});

describe("analyzeHandler - imports", () => {
  it("classifies external imports", () => {
    const result = analyzeHandler(`
      import axios from "axios";
      import { z } from "zod";
    `);
    expect(result.imports.external).toContain("axios");
    expect(result.imports.external).toContain("zod");
    expect(result.imports.internal).toHaveLength(0);
  });

  it("classifies internal imports", () => {
    const result = analyzeHandler(`
      import { helper } from "./utils";
      import config from "@/config";
    `);
    expect(result.imports.internal).toContain("./utils");
    expect(result.imports.internal).toContain("@/config");
    expect(result.imports.external).toHaveLength(0);
  });

  it("flags axios import as warning", () => {
    const result = analyzeHandler(`
      import axios from "axios";
    `);
    expect(result.warnings).toContain('import("axios")');
  });

  it("returns empty analysis for empty code", () => {
    const result = analyzeHandler("");
    expect(result.capabilities).toHaveLength(0);
    expect(result.blockers).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
    expect(result.imports.external).toHaveLength(0);
    expect(result.imports.internal).toHaveLength(0);
  });
});
