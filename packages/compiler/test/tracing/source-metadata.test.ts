import { describe, it, expect } from "vitest";
import { buildManifest } from "../../src/tracing/source-metadata";
import type { HandlerSourceAnalysis } from "../../src/tracing/types";

describe("source-metadata", () => {
  it("should build manifest from handler analyses", () => {
    const analyses: HandlerSourceAnalysis[] = [
      {
        filePath: "/src/handler.ts",
        relativePath: "./handler.ts",
        exportName: "chatTool",
        stableName: "tool.chat_tool",
        nodeId: "node_abc123",
        handlerLine: 5,
        handlerColumn: 0,
        primitives: [
          {
            namespace: "ai",
            method: "generate",
            primitiveType: "ai.generate",
            line: 7,
            column: 20,
            semanticName: "chatResponse",
            inferenceSource: "variable",
            primitiveId: "tool.chat_tool.ai.generate.chatresponse",
            argPreview: { argsCount: 1, firstArgType: "StringLiteral" },
          },
        ],
      },
    ];

    const manifest = buildManifest(analyses);

    expect(manifest.schemaVersion).toBe(1);
    expect(Object.keys(manifest.handlerLocations)).toHaveLength(1);
    expect(Object.keys(manifest.primitiveLocations)).toHaveLength(1);

    const handlerLoc = manifest.handlerLocations["node_abc123"]!;
    expect(handlerLoc.file).toBe("./handler.ts");
    expect(handlerLoc.exportName).toBe("chatTool");
    expect(handlerLoc.stableName).toBe("tool.chat_tool");
    expect(handlerLoc.line).toBe(5);

    const primLoc = manifest.primitiveLocations["tool.chat_tool.ai.generate.chatresponse"]!;
    expect(primLoc.file).toBe("./handler.ts");
    expect(primLoc.handlerId).toBe("node_abc123");
    expect(primLoc.primitiveType).toBe("ai.generate");
    expect(primLoc.line).toBe(7);
  });

  it("should handle empty analyses", () => {
    const manifest = buildManifest([]);
    expect(manifest.schemaVersion).toBe(1);
    expect(Object.keys(manifest.handlerLocations)).toHaveLength(0);
    expect(Object.keys(manifest.primitiveLocations)).toHaveLength(0);
  });

  it("should handle handler with no primitives", () => {
    const analyses: HandlerSourceAnalysis[] = [
      {
        filePath: "/src/simple.ts",
        relativePath: "./simple.ts",
        exportName: "simpleHandler",
        stableName: "tool.simple",
        nodeId: "node_def456",
        handlerLine: 1,
        handlerColumn: 0,
        primitives: [],
      },
    ];

    const manifest = buildManifest(analyses);
    expect(Object.keys(manifest.handlerLocations)).toHaveLength(1);
    expect(Object.keys(manifest.primitiveLocations)).toHaveLength(0);
  });

  it("should handle multiple handlers with shared file", () => {
    const analyses: HandlerSourceAnalysis[] = [
      {
        filePath: "/src/agent.ts",
        relativePath: "./agent.ts",
        exportName: "handlerA",
        stableName: "tool.handler_a",
        nodeId: "node_aaa",
        handlerLine: 5,
        handlerColumn: 0,
        primitives: [
          {
            namespace: "ai",
            method: "generate",
            primitiveType: "ai.generate",
            line: 7,
            column: 10,
            semanticName: null,
            inferenceSource: "hash",
            primitiveId: "tool.handler_a.ai.generate.abc123",
            argPreview: { argsCount: 1 },
          },
        ],
      },
      {
        filePath: "/src/agent.ts",
        relativePath: "./agent.ts",
        exportName: "handlerB",
        stableName: "tool.handler_b",
        nodeId: "node_bbb",
        handlerLine: 15,
        handlerColumn: 0,
        primitives: [
          {
            namespace: "storage",
            method: "get",
            primitiveType: "storage.get",
            line: 17,
            column: 15,
            semanticName: "cached",
            inferenceSource: "variable",
            primitiveId: "tool.handler_b.storage.get.cached",
            argPreview: { argsCount: 1, firstArgType: "StringLiteral" },
          },
        ],
      },
    ];

    const manifest = buildManifest(analyses);
    expect(Object.keys(manifest.handlerLocations)).toHaveLength(2);
    expect(Object.keys(manifest.primitiveLocations)).toHaveLength(2);
  });
});