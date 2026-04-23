import { describe, expect, it } from "vitest";
import type { IRGraph, IRNodeId } from "@kalphq/sdk";
import { validateIR, validateIRBindings } from "../src/validate";

const id = (s: string) => s as IRNodeId;

function makeMinimalGraph(overrides?: Partial<IRGraph>): IRGraph {
  return {
    agentId: "test-agent",
    entries: { onMessage: id("entry_1") },
    nodes: {
      [id("entry_1")]: {
        kind: "entry",
        id: id("entry_1"),
        handler: "onMessage",
      },
      [id("run_1")]: {
        kind: "run",
        id: id("run_1"),
        targetId: "steps.process_query",
        targetKind: "step",
      },
    },
    edges: [
      { from: id("entry_1"), to: id("run_1"), type: "sequential" as const },
    ],
    ...overrides,
  };
}

describe("validateIR", () => {
  it("passes a valid minimal graph", () => {
    const result = validateIR(makeMinimalGraph());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("passes a graph with route entries", () => {
    const result = validateIR(
      makeMinimalGraph({
        entries: {
          onMessage: id("entry_1"),
          [id("route:GET:/health")]: id("entry_2"),
        },
        nodes: {
          [id("entry_1")]: {
            kind: "entry",
            id: id("entry_1"),
            handler: "onMessage",
          },
          [id("entry_2")]: {
            kind: "entry",
            id: id("entry_2"),
            handler: "route:GET:/health",
            method: "GET",
            path: "/health",
          },
          [id("run_1")]: {
            kind: "run",
            id: id("run_1"),
            targetId: "steps.process_query",
            targetKind: "step",
          },
        },
      }),
    );
    expect(result.valid).toBe(true);
  });

  it("fails when agentId is missing", () => {
    const result = validateIR({ ...makeMinimalGraph(), agentId: "" });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("agentId"))).toBe(true);
  });

  it("fails when a node has an invalid kind", () => {
    const result = validateIR({
      ...makeMinimalGraph(),
      nodes: {
        [id("entry_1")]: {
          kind: "entry",
          id: id("entry_1"),
          handler: "onMessage",
        },
        [id("run_1")]: { kind: "unknown_kind", id: id("run_1") } as any,
      },
    });
    expect(result.valid).toBe(false);
  });

  it("fails when edges array contains invalid edge", () => {
    const result = validateIR({
      ...makeMinimalGraph(),
      edges: [{ from: id(""), to: id("run_1"), type: "sequential" as const }],
    });
    expect(result.valid).toBe(false);
  });

  it("fails on non-object input", () => {
    expect(validateIR(null).valid).toBe(false);
    expect(validateIR("string").valid).toBe(false);
    expect(validateIR(42).valid).toBe(false);
  });

  it("passes with wait node", () => {
    const result = validateIR({
      agentId: "agent",
      entries: { onMessage: id("entry_1") },
      nodes: {
        [id("entry_1")]: {
          kind: "entry",
          id: id("entry_1"),
          handler: "onMessage",
        },
        [id("wait_1")]: { kind: "wait", id: id("wait_1"), duration: "30m" },
      },
      edges: [
        { from: id("entry_1"), to: id("wait_1"), type: "sequential" as const },
      ],
    });
    expect(result.valid).toBe(true);
  });

  it("passes with classify node", () => {
    const result = validateIR({
      agentId: "agent",
      entries: { onMessage: id("entry_1") },
      nodes: {
        [id("entry_1")]: {
          kind: "entry",
          id: id("entry_1"),
          handler: "onMessage",
        },
        [id("cls_1")]: {
          kind: "llm.classify",
          id: id("cls_1"),
          input: { text: "hello", labels: ["a", "b"] },
          branches: [{ label: "a", next: undefined }],
        },
      },
      edges: [],
    });
    expect(result.valid).toBe(true);
  });
});

describe("validateIRBindings", () => {
  it("passes when all run targets have matching handlers", () => {
    const graph = makeMinimalGraph();
    const result = validateIRBindings(graph, [
      "onMessage",
      "steps.process_query",
    ]);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("fails when a run target has no matching handler", () => {
    const graph = makeMinimalGraph();
    const result = validateIRBindings(graph, ["onMessage"]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("steps.process_query"))).toBe(
      true,
    );
  });

  it("fails when onMessage entry has no bundled handler", () => {
    const graph = makeMinimalGraph();
    const result = validateIRBindings(graph, ["steps.process_query"]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("onMessage"))).toBe(true);
  });

  it("includes orphan warning for unreferenced bundled handlers", () => {
    const graph = makeMinimalGraph();
    const result = validateIRBindings(graph, [
      "onMessage",
      "steps.process_query",
      "tools.unused_tool",
    ]);
    expect(result.valid).toBe(true); // Orphans are warnings, not errors
    expect(result.warnings?.some((w) => w.includes("unused_tool"))).toBe(true);
  });

  it("passes for graph with no run nodes and only entry", () => {
    const graph: IRGraph = {
      agentId: "agent",
      entries: { onMessage: id("entry_1") },
      nodes: {
        [id("entry_1")]: {
          kind: "entry",
          id: id("entry_1"),
          handler: "onMessage",
        },
      },
      edges: [],
    };
    const result = validateIRBindings(graph, ["onMessage"]);
    expect(result.valid).toBe(true);
  });

  it("skips route entries (no handler expected in v1)", () => {
    const graph: IRGraph = {
      agentId: "agent",
      entries: {
        onMessage: id("entry_1"),
        "route:GET:/health": id("entry_2"),
      },
      nodes: {
        [id("entry_1")]: {
          kind: "entry",
          id: id("entry_1"),
          handler: "onMessage",
        },
        [id("entry_2")]: {
          kind: "entry",
          id: id("entry_2"),
          handler: "route:GET:/health",
          method: "GET",
          path: "/health",
        },
      },
      edges: [],
    };
    const result = validateIRBindings(graph, ["onMessage"]);
    expect(result.valid).toBe(true);
  });

  it("detects entry pointing to missing node", () => {
    const graph: IRGraph = {
      agentId: "agent",
      entries: { onMessage: id("missing_node") },
      nodes: {},
      edges: [],
    };
    const result = validateIRBindings(graph, ["onMessage"]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("missing node"))).toBe(true);
  });
});
