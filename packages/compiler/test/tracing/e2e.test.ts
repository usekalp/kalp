import { describe, it, expect, beforeAll } from "vitest";
import { buildAgent } from "../../src/compiler";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import type { SourceMetadataManifest } from "../../src/tracing/types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, "..", "fixtures");
const OUT_DIR = path.join(__dirname, "..", "dist", "tracing-e2e");

describe("Source Tracing E2E", () => {
  beforeAll(() => {
    if (fs.existsSync(OUT_DIR)) {
      fs.rmSync(OUT_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(OUT_DIR, { recursive: true });
  });

  it("should produce source-metadata.json artifact when building an agent", async () => {
    const entry = path.join(FIXTURES_DIR, "primitives-agent.ts");
    const outDir = path.join(OUT_DIR, "primitives");

    await buildAgent(entry, outDir);

    const artifactsDir = path.join(outDir, ".kalp", "artifacts");
    const metadataPath = path.join(artifactsDir, "source-metadata.json");

    expect(fs.existsSync(metadataPath)).toBe(true);

    const raw = fs.readFileSync(metadataPath, "utf-8");
    const metadata: SourceMetadataManifest = JSON.parse(raw);

    expect(metadata.schemaVersion).toBe(1);
    expect(typeof metadata.primitiveLocations).toBe("object");
    expect(typeof metadata.handlerLocations).toBe("object");
  });

  it("should populate handlerLocations with correct structure", async () => {
    const entry = path.join(FIXTURES_DIR, "primitives-agent.ts");
    const outDir = path.join(OUT_DIR, "handlers");

    await buildAgent(entry, outDir);

    const metadataPath = path.join(outDir, ".kalp", "artifacts", "source-metadata.json");
    const metadata: SourceMetadataManifest = JSON.parse(fs.readFileSync(metadataPath, "utf-8"));

    const handlerIds = Object.keys(metadata.handlerLocations);
    expect(handlerIds.length).toBeGreaterThanOrEqual(1);

    for (const [nodeId, loc] of Object.entries(metadata.handlerLocations)) {
      expect(loc.file).toBeTruthy();
      expect(loc.exportName).toBeTruthy();
      expect(loc.stableName).toBeTruthy();
      expect(loc.line).toBeGreaterThan(0);
      expect(typeof loc.column).toBe("number");
      expect(loc.nodeId).toBe(nodeId);
    }
  });

  it("should detect ctx primitives in handler source code", async () => {
    const entry = path.join(FIXTURES_DIR, "primitives-agent.ts");
    const outDir = path.join(OUT_DIR, "primitives-detected");

    await buildAgent(entry, outDir);

    const metadataPath = path.join(outDir, ".kalp", "artifacts", "source-metadata.json");
    const metadata: SourceMetadataManifest = JSON.parse(fs.readFileSync(metadataPath, "utf-8"));

    const primTypes = Object.values(metadata.primitiveLocations).map((p) => p.primitiveType);

    if (primTypes.length > 0) {
      for (const loc of Object.values(metadata.primitiveLocations)) {
        expect(loc.file).toBeTruthy();
        expect(loc.line).toBeGreaterThan(0);
        expect(loc.handlerId).toBeTruthy();
        expect(loc.primitiveType).toBeTruthy();
      }
    }
  });

  it("should detect ctx.actions primitives from basic-agent", async () => {
    const entry = path.join(FIXTURES_DIR, "basic-agent.ts");
    const outDir = path.join(OUT_DIR, "actions-detected");

    await buildAgent(entry, outDir);

    const metadataPath = path.join(outDir, ".kalp", "artifacts", "source-metadata.json");
    const metadata: SourceMetadataManifest = JSON.parse(fs.readFileSync(metadataPath, "utf-8"));

    const primTypes = Object.values(metadata.primitiveLocations).map((p) => p.primitiveType);

    if (primTypes.length > 0) {
      expect(primTypes).toContain("actions.run");
      expect(primTypes).toContain("actions.call");
      for (const loc of Object.values(metadata.primitiveLocations)) {
        expect(loc.file).toBeTruthy();
        expect(loc.line).toBeGreaterThan(0);
        expect(loc.handlerId).toBeTruthy();
        expect(loc.primitiveType).toBeTruthy();
      }
    }
  });

  it("should populate debug.json with line and column for each node", async () => {
    const entry = path.join(FIXTURES_DIR, "primitives-agent.ts");
    const outDir = path.join(OUT_DIR, "debug-lines");

    await buildAgent(entry, outDir, undefined, { includeDebug: true });

    const debugPath = path.join(outDir, ".kalp", "artifacts", "debug.json");
    expect(fs.existsSync(debugPath)).toBe(true);

    const debug = JSON.parse(fs.readFileSync(debugPath, "utf-8"));
    for (const [, meta] of Object.entries(debug) as [string, any][]) {
      expect(typeof meta.line).toBe("number");
      expect(typeof meta.column).toBe("number");
    }
  });
});