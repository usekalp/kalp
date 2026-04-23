import { describe, expect, it } from "vitest";
import type {
  Step,
  Tool,
  Flow,
  Route,
  IRGraph,
  IRNode,
  IRNodeId,
  EntryIRNode,
  LoopIRNode,
  ClassifyIRNode,
  RunIRNode,
  WaitIRNode,
  GenerateIRNode,
  StreamIRNode,
  FetchIRNode,
} from "@kalphq/sdk";
import { z } from "zod";
import { compileAgent } from "../src/compiler";
import { compileLoop } from "../src/loop";
import { compileClassify } from "../src/classify";
import {
  recordEmissions,
  recordWithBranching,
  type RecordingContext,
  type BranchingResult,
} from "../src/proxy";
import { normalizeGraph } from "../src/normalize";

const createMockStep = (id: string): Step<z.ZodTypeAny, z.ZodTypeAny> => ({
  kind: "step",
  id,
  description: `Mock step ${id}`,
  inputSchema: z.object({ value: z.string() }),
  outputSchema: z.object({ result: z.string() }),
});

const createMockTool = (id: string): Tool<z.ZodTypeAny, unknown> => ({
  kind: "tool",
  id,
  description: `Mock tool ${id}`,
  inputSchema: z.object({ query: z.string() }),
});

const createMockFlow = (
  id: string,
  steps: Step[] = [],
): Flow<unknown, unknown> => ({
  kind: "flow",
  id,
  description: `Mock flow ${id}`,
  steps,
});

const createMockRoute = (
  id: string,
): Route<z.ZodTypeAny | undefined, unknown> => ({
  kind: "route",
  id,
  method: "GET",
  path: `/${id}`,
  inputSchema: undefined,
});

describe("Recording Proxy", () => {
  it("records run emissions", async () => {
    const trace = await recordEmissions(async ({ actions }) => {
      await actions.run({ id: "step_1" }, { value: "test" });
    });

    expect(trace.nodes).toHaveLength(1);
    const node = trace.nodes[0] as RunIRNode;
    expect(node.kind).toBe("run");
    expect(node.targetId).toBe("step_1");
    expect(node.input).toEqual({ value: "test" });
  });

  it("records wait emissions", async () => {
    const trace = await recordEmissions(async ({ actions }) => {
      await actions.wait("30m");
    });

    expect(trace.nodes).toHaveLength(1);
    const node = trace.nodes[0] as WaitIRNode;
    expect(node.kind).toBe("wait");
    expect(node.duration).toBe("30m");
  });

  it("records fetch emissions", async () => {
    const trace = await recordEmissions(async ({ actions }) => {
      await actions.fetch("https://api.example.com/data", { method: "GET" });
    });

    expect(trace.nodes).toHaveLength(1);
    const node = trace.nodes[0] as FetchIRNode;
    expect(node.kind).toBe("fetch");
    expect(node.url).toBe("https://api.example.com/data");
  });

  it("records AI generate emissions", async () => {
    const trace = await recordEmissions(async ({ ai }) => {
      await ai.generate({
        prompt: "Hello",
        model: "openai/gpt-4o",
        schema: z.object({ greeting: z.string() }),
      });
    });

    expect(trace.nodes).toHaveLength(1);
    const node = trace.nodes[0] as GenerateIRNode;
    expect(node.kind).toBe("llm.generate");
    expect(node.model).toBe("openai/gpt-4o");
    expect(node.schema).toBeDefined();
  });

  it("records AI stream emissions", async () => {
    const trace = await recordEmissions(async ({ ai }) => {
      await ai.stream({
        prompt: "Stream me",
        model: "openai/gpt-4o-mini",
      });
    });

    expect(trace.nodes).toHaveLength(1);
    const node = trace.nodes[0] as StreamIRNode;
    expect(node.kind).toBe("llm.stream");
    expect(node.model).toBe("openai/gpt-4o-mini");
  });

  it("records AI classify emissions", async () => {
    const trace = await recordEmissions(async ({ ai }) => {
      await ai.classify({
        input: "This is a question",
        labels: ["question", "statement", "command"],
        model: "openai/gpt-4o",
        confidenceThreshold: 0.8,
      });
    });

    expect(trace.nodes).toHaveLength(1);
    const node = trace.nodes[0] as ClassifyIRNode;
    expect(node.kind).toBe("llm.classify");
    expect(node.input.text).toBe("This is a question");
    expect(node.input.labels).toEqual(["question", "statement", "command"]);
    expect(node.confidenceThreshold).toBe(0.8);
    expect(node.branches).toEqual([]);
  });

  it("records sequential emissions in order", async () => {
    const trace = await recordEmissions(async ({ actions, ai }) => {
      await actions.wait("1s");
      await actions.run({ id: "step_a" });
      await ai.generate({ prompt: "test", model: "openai/gpt-4o" });
    });

    expect(trace.nodes).toHaveLength(3);
    expect(trace.nodes[0]!.kind).toBe("wait");
    expect(trace.nodes[1]!.kind).toBe("run");
    expect(trace.nodes[2]!.kind).toBe("llm.generate");
  });

  it("throws on nested loop", async () => {
    await expect(
      recordEmissions(async ({ actions }) => {
        actions.loop(async () => {
          await actions.wait("1h");
        });
      }),
    ).rejects.toThrow("Nested loop capture must be compiled via compileLoop.");
  });
});

describe("Loop Compiler", () => {
  it("compiles a basic loop with wait schedule", async () => {
    const result = await compileLoop(async ({ actions }: RecordingContext) => {
      await actions.run({ id: "process" }, { data: "input" });
      await actions.wait("1h");
    });

    expect(result.loopNode.kind).toBe("loop");
    expect(result.loopNode.schedule).toEqual({
      type: "interval",
      value: "1h",
    });
    expect(result.loopNode.persistent).toBe(true);
    expect(Object.keys(result.nodes).length).toBeGreaterThan(0);
    expect(result.edges.length).toBeGreaterThan(0);
  });

  it("defaults to event-driven when no wait", async () => {
    const result = await compileLoop(async ({ actions }: RecordingContext) => {
      await actions.run({ id: "step_only" });
    });

    expect(result.loopNode.schedule).toEqual({ type: "event-driven" });
  });

  it("uses first wait only for schedule inference", async () => {
    const result = await compileLoop(async ({ actions }: RecordingContext) => {
      await actions.wait("5m");
      await actions.run({ id: "first" });
      await actions.wait("1h"); // Should be ignored
      await actions.run({ id: "second" });
    });

    expect(result.loopNode.schedule).toEqual({
      type: "interval",
      value: "5m",
    });
  });

  it("creates entry pointer to first node", async () => {
    const result = await compileLoop(async ({ actions }: RecordingContext) => {
      await actions.run({ id: "entry_node" });
      await actions.wait("1s");
    });

    const firstNode = Object.values(result.nodes).find(
      (n): n is RunIRNode => n.kind === "run" && n.targetId === "entry_node",
    );
    expect(firstNode).toBeDefined();
    expect(result.loopNode.entry).toBe(firstNode!.id);
  });

  it("throws on empty loop body", async () => {
    await expect(compileLoop(async () => {})).rejects.toThrow(
      "Loop body produced no IR nodes.",
    );
  });
});

describe("Classify Compiler", () => {
  it("compiles basic classify node", () => {
    const node = compileClassify({
      input: "Classify this",
      labels: ["A", "B", "C"],
    });

    expect(node.kind).toBe("llm.classify");
    expect(node.input.text).toBe("Classify this");
    expect(node.input.labels).toEqual(["A", "B", "C"]);
    expect(node.branches).toEqual([]);
  });

  it("includes model and confidence threshold", () => {
    const node = compileClassify({
      input: "test",
      labels: ["x", "y"],
      model: "anthropic/claude-sonnet-4.5",
      confidenceThreshold: 0.95,
    });

    expect(node.model).toBe("anthropic/claude-sonnet-4.5");
    expect(node.confidenceThreshold).toBe(0.95);
  });

  it("accepts pre-wired branches", () => {
    const node = compileClassify({
      input: "route me",
      labels: ["path_a", "path_b"],
      branches: [
        { label: "path_a", next: "node_a" as IRNodeId },
        { label: "path_b", next: "node_b" as IRNodeId },
      ],
      fallback: "fallback_node" as IRNodeId,
    });

    expect(node.branches).toHaveLength(2);
    expect(node.branches[0]!.label).toBe("path_a");
    expect(node.branches[1]!.next).toBe("node_b");
    expect(node.fallback).toBe("fallback_node");
  });
});

describe("Agent Compiler", () => {
  it("compiles minimal agent with steps", async () => {
    const agent = {
      id: "test-agent",
      steps: [createMockStep("step_1"), createMockStep("step_2")],
    };

    const graph = await compileAgent(agent);

    expect(graph.agentId).toBe("test-agent");
    expect(graph.entries.onMessage).toBeDefined();
    // 1 entry + 2 run nodes
    expect(Object.keys(graph.nodes).length).toBe(3);
    // entry→run1, run1→run2
    expect(graph.edges).toHaveLength(2);

    // EntryIRNode is the root
    const entryNode = graph.nodes[graph.entries.onMessage!] as EntryIRNode;
    expect(entryNode.kind).toBe("entry");
    expect(entryNode.handler).toBe("onMessage");
  });

  it("populates targetKind on run nodes", async () => {
    const flowStep = createMockStep("flow_inner");
    const agent = {
      id: "kind-agent",
      steps: [createMockStep("s")],
      tools: [createMockTool("t")],
      flows: [createMockFlow("f", [flowStep])],
    };

    const graph = await compileAgent(agent);

    const runNodes = Object.values(graph.nodes).filter(
      (n): n is RunIRNode => n.kind === "run",
    );
    const kinds = runNodes.map((n) => n.targetKind);
    expect(kinds).toContain("step");
    expect(kinds).toContain("tool");
    // flows are expanded at compile-time: no "flow" targetKind in IR
    expect(kinds).not.toContain("flow");
  });

  it("populates inputSchema/outputSchema from zod schemas", async () => {
    const agent = {
      id: "schema-agent",
      steps: [createMockStep("s1")],
    };

    const graph = await compileAgent(agent);

    const runNode = Object.values(graph.nodes).find(
      (n): n is RunIRNode => n.kind === "run" && n.targetId === "s1",
    );
    expect(runNode).toBeDefined();
    expect(runNode!.inputSchema).toBeDefined();
    expect(runNode!.outputSchema).toBeDefined();
  });

  it("compiles agent with tools", async () => {
    const agent = {
      id: "tool-agent",
      steps: [],
      tools: [createMockTool("tool_1"), createMockTool("tool_2")],
    };

    const graph = await compileAgent(agent);

    const toolRuns = Object.values(graph.nodes).filter(
      (n): n is RunIRNode => n.kind === "run" && n.targetId.startsWith("tool_"),
    );
    expect(toolRuns).toHaveLength(2);
    expect(toolRuns[0]!.targetKind).toBe("tool");
  });

  it("compiles agent with flows (expanded inline)", async () => {
    const step = createMockStep("flow_step");
    const flow = createMockFlow("my_flow", [step]);

    const agent = {
      id: "flow-agent",
      steps: [step],
      flows: [flow],
    };

    const graph = await compileAgent(agent);

    // flows are expanded at compile-time: no run node for "my_flow" itself
    const flowByFlowId = Object.values(graph.nodes).filter(
      (n): n is RunIRNode => n.kind === "run" && n.targetId === "my_flow",
    );
    expect(flowByFlowId).toHaveLength(0);

    // instead, the steps inside the flow appear as run nodes
    const expandedStep = Object.values(graph.nodes).find(
      (n): n is RunIRNode => n.kind === "run" && n.targetId === "flow_step",
    );
    expect(expandedStep).toBeDefined();
    expect(expandedStep!.targetKind).toBe("step");
  });

  it("compiles complete agent with all components", async () => {
    const step = createMockStep("process");
    const tool = createMockTool("search");
    const flow = createMockFlow("pipeline", [step]);

    const agent = {
      id: "complete-agent",
      steps: [step],
      tools: [tool],
      flows: [flow],
    };

    const graph = await compileAgent(agent);

    expect(graph.agentId).toBe("complete-agent");
    // 1 entry + 3 run
    expect(Object.keys(graph.nodes).length).toBe(4);
    // entry→run1, run1→run2, run2→run3
    expect(graph.edges).toHaveLength(3);

    const runNodes = Object.values(graph.nodes).filter(
      (n): n is RunIRNode => n.kind === "run",
    );
    expect(runNodes).toHaveLength(3);
  });

  it("creates valid sequential edges between runs", async () => {
    const agent = {
      id: "sequential-agent",
      steps: [createMockStep("s1"), createMockStep("s2"), createMockStep("s3")],
    };

    const graph = await compileAgent(agent);

    // entry→s1, s1→s2, s2→s3
    expect(graph.edges).toHaveLength(3);

    // Entry node edges to first run
    const entryEdge = graph.edges.find(
      (e) => e.from === graph.entries.onMessage,
    );
    expect(entryEdge).toBeDefined();
  });

  it("throws on non-object agent", async () => {
    await expect(compileAgent(null)).rejects.toThrow("agent must be an object");
    await expect(compileAgent("string")).rejects.toThrow(
      "agent must be an object",
    );
  });
});

describe("Graph Normalizer", () => {
  it("validates valid graph with entries", () => {
    const graph: IRGraph = {
      agentId: "test",
      entries: { onMessage: "entry_1" as IRNodeId },
      nodes: {
        ["entry_1" as IRNodeId]: {
          kind: "entry",
          id: "entry_1" as IRNodeId,
          handler: "onMessage",
        } as EntryIRNode,
        ["run_1" as IRNodeId]: {
          kind: "run",
          id: "run_1" as IRNodeId,
          targetId: "x",
          targetKind: "step",
        } as RunIRNode,
      },
      edges: [{ from: "entry_1" as IRNodeId, to: "run_1" as IRNodeId }],
    };

    const normalized = normalizeGraph(graph);
    expect(normalized.agentId).toBe("test");
  });

  it("throws on empty entries", () => {
    const graph: IRGraph = {
      agentId: "test",
      entries: {},
      nodes: {},
      edges: [],
    };

    expect(() => normalizeGraph(graph)).toThrow(
      "Graph must have at least one entry point.",
    );
  });

  it("throws on missing entry node", () => {
    const graph: IRGraph = {
      agentId: "test",
      entries: { onMessage: "missing" as IRNodeId },
      nodes: {},
      edges: [],
    };

    expect(() => normalizeGraph(graph)).toThrow(
      "Missing node missing referenced by entries.onMessage.",
    );
  });

  it("throws on dangling edge source", () => {
    const graph: IRGraph = {
      agentId: "test",
      entries: { onMessage: "run_1" as IRNodeId },
      nodes: {
        ["run_1" as IRNodeId]: {
          kind: "run",
          id: "run_1" as IRNodeId,
          targetId: "x",
          targetKind: "step",
        } as RunIRNode,
      },
      edges: [{ from: "missing" as IRNodeId, to: "run_1" as IRNodeId }],
    };

    expect(() => normalizeGraph(graph)).toThrow(
      "Missing node missing referenced by edge.from.",
    );
  });

  it("throws on dangling edge target", () => {
    const graph: IRGraph = {
      agentId: "test",
      entries: { onMessage: "run_1" as IRNodeId },
      nodes: {
        ["run_1" as IRNodeId]: {
          kind: "run",
          id: "run_1" as IRNodeId,
          targetId: "x",
          targetKind: "step",
        } as RunIRNode,
      },
      edges: [{ from: "run_1" as IRNodeId, to: "missing" as IRNodeId }],
    };

    expect(() => normalizeGraph(graph)).toThrow(
      "Missing node missing referenced by edge.to.",
    );
  });

  it("validates classify branch references", () => {
    const graph: IRGraph = {
      agentId: "test",
      entries: { onMessage: "classify_1" as IRNodeId },
      nodes: {
        ["classify_1" as IRNodeId]: {
          kind: "llm.classify",
          id: "classify_1" as IRNodeId,
          input: { text: "test", labels: ["a", "b"] },
          branches: [
            { label: "a", next: "run_a" as IRNodeId },
            { label: "b", next: "run_b" as IRNodeId },
          ],
        } as ClassifyIRNode,
        ["run_a" as IRNodeId]: {
          kind: "run",
          id: "run_a" as IRNodeId,
          targetId: "a",
          targetKind: "step",
        } as RunIRNode,
        ["run_b" as IRNodeId]: {
          kind: "run",
          id: "run_b" as IRNodeId,
          targetId: "b",
          targetKind: "step",
        } as RunIRNode,
      },
      edges: [],
    };

    const normalized = normalizeGraph(graph);
    expect(normalized.agentId).toBe("test");
  });

  it("throws on missing classify branch target", () => {
    const graph: IRGraph = {
      agentId: "test",
      entries: { onMessage: "classify_1" as IRNodeId },
      nodes: {
        ["classify_1" as IRNodeId]: {
          kind: "llm.classify",
          id: "classify_1" as IRNodeId,
          input: { text: "test", labels: ["a"] },
          branches: [{ label: "a", next: "missing" as IRNodeId }],
        } as ClassifyIRNode,
      },
      edges: [],
    };

    expect(() => normalizeGraph(graph)).toThrow(
      "Missing node missing referenced by classify.branch.",
    );
  });

  it("validates loop entry references", () => {
    const graph: IRGraph = {
      agentId: "test",
      entries: { onMessage: "loop_1" as IRNodeId },
      nodes: {
        ["loop_1" as IRNodeId]: {
          kind: "loop",
          id: "loop_1" as IRNodeId,
          entry: "run_start" as IRNodeId,
          detached: true,
          schedule: { type: "interval", value: "1h" },
          lifecycle: {},
          persistent: true,
        } as LoopIRNode,
        ["run_start" as IRNodeId]: {
          kind: "run",
          id: "run_start" as IRNodeId,
          targetId: "x",
          targetKind: "step",
        } as RunIRNode,
      },
      edges: [],
    };

    const normalized = normalizeGraph(graph);
    expect(normalized.agentId).toBe("test");
  });

  it("throws on missing loop entry", () => {
    const graph: IRGraph = {
      agentId: "test",
      entries: { onMessage: "loop_1" as IRNodeId },
      nodes: {
        ["loop_1" as IRNodeId]: {
          kind: "loop",
          id: "loop_1" as IRNodeId,
          entry: "missing" as IRNodeId,
          detached: true,
          schedule: { type: "interval", value: "1h" },
          lifecycle: {},
          persistent: true,
        } as LoopIRNode,
      },
      edges: [],
    };

    expect(() => normalizeGraph(graph)).toThrow(
      "Missing node missing referenced by loop.entry.",
    );
  });
});

describe("Two-Phase Recording (recordWithBranching)", () => {
  it("returns simple trace when no classify", async () => {
    const result = await recordWithBranching(async ({ actions }) => {
      await actions.run({ id: "step_1" });
      await actions.wait("5s");
    });

    expect("nodes" in result).toBe(true);
    const trace = result as { nodes: IRNode[] };
    expect(trace.nodes).toHaveLength(2);
  });

  it("detects classify and produces branching result", async () => {
    const result = await recordWithBranching(async ({ actions, ai }) => {
      await actions.run({ id: "pre_step" });

      const intent = await ai.classify({
        input: "test",
        labels: ["a", "b"],
      });

      if (intent === "a") {
        await actions.run({ id: "branch_a" });
      }
      if (intent === "b") {
        await actions.run({ id: "branch_b" });
      }
    });

    expect("branches" in result).toBe(true);
    const branching = result as BranchingResult;
    expect(branching.preTrace).toHaveLength(1);
    expect(branching.preTrace[0]!.kind).toBe("run");
    expect(branching.classify.labels).toEqual(["a", "b"]);
    expect(branching.branches.size).toBe(2);

    const branchA = branching.branches.get("a")!;
    const branchB = branching.branches.get("b")!;
    expect(branchA).toHaveLength(1);
    expect((branchA[0] as RunIRNode).targetId).toBe("branch_a");
    expect(branchB).toHaveLength(1);
    expect((branchB[0] as RunIRNode).targetId).toBe("branch_b");
  });

  it("handles empty branches", async () => {
    const result = await recordWithBranching(async ({ actions, ai }) => {
      const intent = await ai.classify({
        input: "test",
        labels: ["active", "noop"],
      });

      if (intent === "active") {
        await actions.run({ id: "do_stuff" });
      }
      // noop branch is empty
    });

    const branching = result as BranchingResult;
    expect(branching.branches.get("active")!).toHaveLength(1);
    expect(branching.branches.get("noop")!).toHaveLength(0);
  });

  it("throws on multiple classify calls", async () => {
    await expect(
      recordWithBranching(async ({ ai }) => {
        await ai.classify({ input: "a", labels: ["x"] });
        await ai.classify({ input: "b", labels: ["y"] });
      }),
    ).rejects.toThrow("Only one ai.classify() per handler is supported.");
  });

  it("preserves label order", async () => {
    const result = await recordWithBranching(async ({ ai }) => {
      await ai.classify({
        input: "test",
        labels: ["z", "a", "m"],
      });
    });

    const branching = result as BranchingResult;
    const keys = [...branching.branches.keys()];
    expect(keys).toEqual(["z", "a", "m"]);
  });

  it("loop inside branch only appears in correct branch", async () => {
    const result = await recordWithBranching(async ({ actions, ai }) => {
      const intent = await ai.classify({
        input: "test",
        labels: ["research", "chat"],
      });

      if (intent === "research") {
        await actions.run({ id: "loop_step" });
        await actions.wait("1h");
      }
    });

    const branching = result as BranchingResult;
    expect(branching.branches.get("research")!.length).toBeGreaterThan(0);
    expect(branching.branches.get("chat")!).toHaveLength(0);
  });
});

describe("Integration: Full Agent with Loop and Classify", () => {
  it("compiles agent with loop subgraph", async () => {
    const step = createMockStep("processor");

    const agent = {
      id: "loop-agent",
      steps: [step],
    };

    // Compile loop separately
    const loopResult = await compileLoop(
      async ({ actions }: RecordingContext) => {
        await actions.run({ id: "processor" });
        await actions.wait("30m");
      },
    );

    expect(loopResult.loopNode.kind).toBe("loop");
    expect(loopResult.loopNode.detached).toBe(true);
    expect(loopResult.nodes[loopResult.loopNode.entry]).toBeDefined();
  });

  it("records full workflow trace (simpleMode)", async () => {
    const trace = await recordEmissions(async ({ actions, ai }) => {
      await actions.run({ id: "fetch_data" });
      await ai.classify({
        input: "What to do next?",
        labels: ["process", "skip"],
      });
      await actions.wait("5s");
      await ai.generate({ prompt: "Complete", model: "openai/gpt-4o" });
    });

    expect(trace.nodes).toHaveLength(4);
    expect(trace.nodes[0]!.kind).toBe("run");
    expect(trace.nodes[1]!.kind).toBe("llm.classify");
    expect(trace.nodes[2]!.kind).toBe("wait");
    expect(trace.nodes[3]!.kind).toBe("llm.generate");
  });
});
