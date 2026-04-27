import { describe, expect, it } from "vitest";
import type { IRGraph, EntryIRNode, HandlerIRNode } from "@kalphq/sdk";
import { z } from "zod";
import { compileAgent } from "../src/compiler";
import { normalizeGraph } from "../src/normalize";

const createMockStep = (id: string) => ({
  kind: "step" as const,
  id,
  description: `Mock step ${id}`,
  inputSchema: z.object({ value: z.string() }),
  outputSchema: z.object({ result: z.string() }),
});

const createMockTool = (id: string) => ({
  kind: "tool" as const,
  id,
  description: `Mock tool ${id}`,
  inputSchema: z.object({ query: z.string() }),
});

const createMockRoute = (id: string) => ({
  kind: "route" as const,
  id,
  method: "GET" as const,
  path: `/${id}`,
  inputSchema: undefined,
  handler: async () => ({ status: "ok" }),
});

describe("v2 Agent Compiler", () => {
  it("compiles minimal agent with lifecycle handlers only", () => {
    const agent = {
      id: "test-agent",
      onMessage: async () => ({ status: "ok" }),
    };

    const graph = compileAgent(agent);

    expect(graph.version).toBe(2);
    expect(graph.agentId).toBe("test-agent");
    expect(graph.entries.onMessage).toBeDefined();
    // v2: entry + handler node (2 nodes)
    expect(Object.keys(graph.nodes).length).toBe(2);
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]!.type).toBe("sequential");

    // Entry node points to handler
    const entryNode = graph.nodes[graph.entries.onMessage!] as EntryIRNode;
    expect(entryNode.kind).toBe("entry");
    expect(entryNode.handler).toBe("onMessage");
  });

  it("compiles agent with steps (v2 handler nodes)", () => {
    const agent = {
      id: "step-agent",
      steps: [createMockStep("step_1"), createMockStep("step_2")],
      onMessage: async () => ({ status: "ok" }),
    };

    const graph = compileAgent(agent);

    // v2: entry + handler (onMessage) + handler (step_1) + handler (step_2) = 4 nodes
    const nodes = Object.values(graph.nodes);
    expect(nodes.length).toBe(4);

    // Handler nodes have moduleRef pointing to bundled code
    const handlerNodes = nodes.filter(
      (n): n is HandlerIRNode => n.kind === "handler",
    );
    expect(handlerNodes.length).toBe(3); // onMessage, step_1, step_2

    // All handlers should have a handlerType
    for (const h of handlerNodes) {
      expect(h.handlerType).toBeDefined();
    }

    // All edges are sequential
    for (const edge of graph.edges) {
      expect(edge.type).toBe("sequential");
    }
  });

  it("compiles agent with tools as handler nodes", () => {
    const agent = {
      id: "tool-agent",
      tools: [createMockTool("search"), createMockTool("calc")],
      onMessage: async () => ({ status: "ok" }),
    };

    const graph = compileAgent(agent);

    const handlerNodes = Object.values(graph.nodes).filter(
      (n): n is HandlerIRNode => n.kind === "handler",
    );

    // 1 onMessage + 2 tools = 3 handlers
    expect(handlerNodes.length).toBe(3);

    // Tool handlers have moduleRef like "tools.<id>"
    const toolHandlers = handlerNodes.filter((h) =>
      h.moduleRef.startsWith("tools."),
    );
    expect(toolHandlers.length).toBe(2);

    // All tool handlers should have handlerType "tool"
    for (const h of toolHandlers) {
      expect(h.handlerType).toBe("tool");
    }
  });

  it("compiles agent with routes as handler nodes", () => {
    const agent = {
      id: "route-agent",
      routes: [createMockRoute("health"), createMockRoute("status")],
      onMessage: async () => ({ status: "ok" }),
    };

    const graph = compileAgent(agent);

    // Route entries should exist
    expect(graph.entries["route:GET:/health"]).toBeDefined();
    expect(graph.entries["route:GET:/status"]).toBeDefined();

    const handlerNodes = Object.values(graph.nodes).filter(
      (n): n is HandlerIRNode => n.kind === "handler",
    );

    // 1 onMessage + 2 routes = 3 handlers
    expect(handlerNodes.length).toBe(3);

    // Route handlers have moduleRef like "routes.<id>"
    const routeHandlers = handlerNodes.filter((h) =>
      h.moduleRef.startsWith("routes."),
    );
    expect(routeHandlers.length).toBe(2);

    // All route handlers should have handlerType "route"
    for (const h of routeHandlers) {
      expect(h.handlerType).toBe("route");
    }
  });

  it("compiles agent with onInit and onTick lifecycle handlers", () => {
    const agent = {
      id: "lifecycle-agent",
      onMessage: async () => ({ status: "ok" }),
      onInit: async () => ({ initialized: true }),
      onTick: async () => ({ ticked: true }),
    };

    const graph = compileAgent(agent);

    // Entries should exist
    expect(graph.entries.onMessage).toBeDefined();
    expect(graph.entries.onInit).toBeDefined();
    expect(graph.entries.onTick).toBeDefined();

    // Handler nodes for each lifecycle
    const handlerNodes = Object.values(graph.nodes).filter(
      (n): n is HandlerIRNode => n.kind === "handler",
    );
    expect(handlerNodes.length).toBe(3);

    const moduleRefs = handlerNodes.map((h) => h.moduleRef);
    expect(moduleRefs).toContain("onMessage");
    expect(moduleRefs).toContain("onInit");
    expect(moduleRefs).toContain("onTick");

    // All lifecycle handlers should have handlerType "lifecycle"
    for (const h of handlerNodes) {
      expect(h.handlerType).toBe("lifecycle");
    }
  });

  it("throws on non-object agent", () => {
    expect(() => compileAgent(null as any)).toThrow("agent must be an object");
    expect(() => compileAgent("string" as any)).toThrow(
      "agent must be an object",
    );
  });

  it("throws when agent id is missing", () => {
    expect(() => compileAgent({} as any)).toThrow(
      "compileAgent: agent.id is required",
    );
  });

  it("handler nodes have undefined schemas by default", () => {
    const agent = {
      id: "schema-agent",
      onMessage: async () => ({ status: "ok" }),
    };

    const graph = compileAgent(agent);
    const handlerNode = Object.values(graph.nodes).find(
      (n): n is HandlerIRNode => n.kind === "handler",
    );

    expect(handlerNode).toBeDefined();
    expect(handlerNode!.inputSchema).toBeUndefined();
    expect(handlerNode!.outputSchema).toBeUndefined();
  });

  it("creates sequential edges between entry and all handlers", () => {
    const agent = {
      id: "edge-agent",
      steps: [createMockStep("s1")],
      tools: [createMockTool("t1")],
      onMessage: async () => ({ status: "ok" }),
    };

    const graph = compileAgent(agent);

    // All edges should be sequential (v2 only has sequential and event)
    for (const edge of graph.edges) {
      expect(["sequential", "event"]).toContain(edge.type);
    }
  });

  it("graph normalizer validates v2 IR", () => {
    const graph = compileAgent({
      id: "norm-agent",
      onMessage: async () => ({ status: "ok" }),
    });

    const normalized = normalizeGraph(graph);
    expect(normalized.agentId).toBe("norm-agent");
    expect(normalized.version).toBe(2);
  });

  it("throws on empty entries", () => {
    // This shouldn't happen with compileAgent but normalizeGraph should catch it
    const graph: IRGraph = {
      version: 2,
      agentId: "test",
      entries: {},
      nodes: {},
      edges: [],
    };

    expect(() => normalizeGraph(graph)).toThrow(
      "Graph must have at least one entry point.",
    );
  });
});
