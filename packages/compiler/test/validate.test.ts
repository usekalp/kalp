import { describe, expect, it } from "vitest";
import type {
  IRGraph,
  IRNodeId,
  EntryIRNode,
  HandlerIRNode,
} from "@kalphq/sdk";
import { validateIR, validateIRBindings } from "../src/validate";

const id = (s: string) => s as IRNodeId;

/**
 * Creates a minimal v2 IR graph with only entry and handler nodes,
 * and sequential/event edges.
 */
function makeMinimalGraph(overrides?: Partial<IRGraph>): IRGraph {
  const entryNode: EntryIRNode = {
    kind: "entry",
    id: id("entry_1"),
    handler: "onMessage",
  };
  const handlerNode: HandlerIRNode = {
    kind: "handler",
    id: id("handler_1"),
    moduleRef: "onMessage",
    handlerType: "lifecycle",
    inputSchema: undefined,
    outputSchema: undefined,
  };

  return {
    version: 2,
    agentId: "test-agent",
    entries: { onMessage: id("entry_1") },
    nodes: {
      [id("entry_1")]: entryNode,
      [id("handler_1")]: handlerNode,
    },
    edges: [
      { from: id("entry_1"), to: id("handler_1"), type: "sequential" as const },
    ],
    ...overrides,
  };
}

describe("validateIR", () => {
  it("passes a valid minimal v2 graph", () => {
    const result = validateIR(makeMinimalGraph());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("fails without version 2", () => {
    const graph = { ...makeMinimalGraph(), version: 1 };
    const result = validateIR(graph);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("version"))).toBe(true);
  });

  it("passes a graph with route entries", () => {
    const entryOnMessage: EntryIRNode = {
      kind: "entry",
      id: id("entry_1"),
      handler: "onMessage",
    };
    const entryRoute: EntryIRNode = {
      kind: "entry",
      id: id("entry_2"),
      handler: "routes.health",
      method: "GET",
      path: "/health",
    };
    const handlerOnMessage: HandlerIRNode = {
      kind: "handler",
      id: id("handler_1"),
      moduleRef: "onMessage",
      handlerType: "lifecycle",
    };
    const handlerRoute: HandlerIRNode = {
      kind: "handler",
      id: id("handler_2"),
      moduleRef: "routes.health",
      handlerType: "route",
    };

    const result = validateIR({
      version: 2,
      agentId: "test-agent",
      entries: {
        onMessage: id("entry_1"),
        "route:GET:/health": id("entry_2"),
      },
      nodes: {
        [id("entry_1")]: entryOnMessage,
        [id("entry_2")]: entryRoute,
        [id("handler_1")]: handlerOnMessage,
        [id("handler_2")]: handlerRoute,
      },
      edges: [
        { from: id("entry_1"), to: id("handler_1"), type: "sequential" },
        { from: id("entry_2"), to: id("handler_2"), type: "sequential" },
      ],
    });
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
        [id("bad_1")]: { kind: "run", id: id("bad_1") } as any,
      },
    });
    expect(result.valid).toBe(false);
  });

  it("fails when edges array contains invalid edge", () => {
    const result = validateIR({
      ...makeMinimalGraph(),
      edges: [
        { from: id(""), to: id("handler_1"), type: "sequential" as const },
      ],
    });
    expect(result.valid).toBe(false);
  });

  it("fails on non-object input", () => {
    expect(validateIR(null).valid).toBe(false);
    expect(validateIR("string").valid).toBe(false);
    expect(validateIR(42).valid).toBe(false);
  });

  it("fails with v1 node kinds like run", () => {
    const result = validateIR({
      version: 2,
      agentId: "agent",
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
          targetId: "steps.x",
          targetKind: "step",
        } as any,
      },
      edges: [],
    });
    expect(result.valid).toBe(false);
  });
});

describe("validateIRBindings", () => {
  it("passes when all handler nodes have matching bundled modules", () => {
    const graph = makeMinimalGraph();
    const result = validateIRBindings(graph, ["onMessage"]);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("fails when a handler node has no matching bundled module", () => {
    const handlerNode: HandlerIRNode = {
      kind: "handler",
      id: id("handler_1"),
      moduleRef: "steps.process_query",
      handlerType: "step",
    };
    const graph: IRGraph = {
      version: 2,
      agentId: "test",
      entries: { onMessage: id("entry_1") },
      nodes: {
        [id("entry_1")]: {
          kind: "entry",
          id: id("entry_1"),
          handler: "onMessage",
        },
        [id("handler_1")]: handlerNode,
      },
      edges: [],
    };
    const result = validateIRBindings(graph, ["onMessage"]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("steps.process_query"))).toBe(
      true,
    );
  });

  it("fails when entry's handler is not in bundled modules", () => {
    const graph = makeMinimalGraph();
    // graph has handler moduleRef "onMessage", but we only provide "steps.process_query"
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

  it("fails for entry without outgoing edge (no execution path)", () => {
    const graph: IRGraph = {
      version: 2,
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
    expect(result.valid).toBe(false);
    expect(
      result.errors.some(
        (e) => e.includes("onMessage") && e.includes("no execution path"),
      ),
    ).toBe(true);
  });

  it("validates route entries with handler nodes in v2", () => {
    const graph: IRGraph = {
      version: 2,
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
          handler: "routes.health",
          method: "GET",
          path: "/health",
        },
        [id("handler_1")]: {
          kind: "handler",
          id: id("handler_1"),
          moduleRef: "onMessage",
          handlerType: "lifecycle",
        },
        [id("handler_2")]: {
          kind: "handler",
          id: id("handler_2"),
          moduleRef: "routes.health",
          handlerType: "route",
        },
      },
      edges: [
        { from: id("entry_1"), to: id("handler_1"), type: "sequential" },
        { from: id("entry_2"), to: id("handler_2"), type: "sequential" },
      ],
    };
    const result = validateIRBindings(graph, ["onMessage", "routes.health"]);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("detects entry pointing to missing node", () => {
    const graph: IRGraph = {
      version: 2,
      agentId: "agent",
      entries: { onMessage: id("missing_node") },
      nodes: {},
      edges: [],
    };
    const result = validateIRBindings(graph, ["onMessage"]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("missing node"))).toBe(true);
  });

  it("fails v1 graphs with classify nodes", () => {
    const graph = {
      version: 2,
      agentId: "agent",
      entries: { onMessage: id("entry_1") },
      nodes: {
        [id("entry_1")]: {
          kind: "entry",
          id: id("entry_1"),
          handler: "onMessage",
        },
        [id("classify_1")]: {
          kind: "llm.classify",
          id: id("classify_1"),
          input: { text: "test", labels: ["a"] },
          branches: [{ label: "a", next: null }],
        },
      },
      edges: [],
    };
    const result = validateIR(graph);
    expect(result.valid).toBe(false);
  });
});
