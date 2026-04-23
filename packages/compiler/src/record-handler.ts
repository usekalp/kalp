import type { IRNode, IREdge } from "@kalphq/sdk";
import { createIdGenerator } from "@/ids";
import {
  createRecordingContext,
  patchGlobals,
  restoreGlobals,
  ClassifySentinel,
  assertDeterministic,
  CompileError,
  type RecordingContext,
  type ClassifyCapture,
} from "@/proxy";

// ── Types ──

export interface LoopCapture {
  body: () => Promise<void>;
}

export interface LinearTrace {
  kind: "linear";
  nodes: IRNode[];
  edges?: IREdge[]; // FIX 2: edges de tipo "data" para bindings
  loopCaptures: LoopCapture[];
}

export interface BranchingTrace {
  kind: "branching";
  preNodes: IRNode[];
  edges?: IREdge[]; // FIX 2: edges de tipo "data" para bindings
  classify: ClassifyCapture;
  branches: Map<string, IRNode[]>;
  loopCaptures: LoopCapture[]; // Loops captured before classify (pre-classify loops)
}

export type ExecutionTrace = LinearTrace | BranchingTrace;

// Route handler type for type-safe adapter
type RouteHandler = (
  req: unknown,
  res: {
    json: (body?: unknown) => unknown;
    status: (code: number) => unknown;
    send: (body?: unknown) => unknown;
  },
  ctx: unknown,
) => Promise<unknown>;

export function adaptRouteHandler(routeHandler: RouteHandler) {
  return async (ctx: unknown) => {
    const mockReq = {
      body: {},
      query: {},
      params: {},
      headers: {},
    };
    const mockRes = {
      json: (body?: unknown) => body,
      send: (body?: unknown) => body,
      status: (_: number) => mockRes,
    };
    return routeHandler(mockReq, mockRes, ctx);
  };
}

// ── Delegate-based mock context ──

interface ActionDelegate {
  ctx: RecordingContext;
}

function buildMockContext(
  delegate: ActionDelegate,
  loopCaptures: LoopCapture[],
): Record<string, unknown> {
  return {
    actions: {
      run: (node: unknown, input?: unknown) =>
        delegate.ctx.actions.run(node as { id: string; kind?: string }, input),
      wait: (duration: unknown) =>
        delegate.ctx.actions.wait(duration as string | number),
      fetch: (input: unknown, init?: unknown) =>
        delegate.ctx.actions.fetch(
          input as string | URL | Request,
          init as RequestInit | undefined,
        ),
      loop: (body: () => Promise<void>) => {
        loopCaptures.push({ body });
      },
    },
    ai: {
      generate: (params: unknown) =>
        delegate.ctx.ai.generate(
          params as Record<string, unknown> & { model?: string },
        ),
      stream: (params: unknown) =>
        delegate.ctx.ai.stream(
          params as Record<string, unknown> & { model?: string },
        ),
      classify: (params: unknown) =>
        delegate.ctx.ai.classify(
          params as {
            input: string;
            labels: string[];
            model?: string;
            confidenceThreshold?: number;
          },
        ),
    },
    storage: {
      get: async () => null,
      put: async () => {},
      delete: async () => {},
    },
    vault: { get: async () => "" },
    auth: {
      userId: "compiler",
      hasPermission: () => true,
      claims: {},
    },
    memory: {
      list: async () => ({ items: [], nextCursor: undefined }),
      append: async () => {},
      summarize: async () => "",
    },
    message: { text: "__compile__", senderId: "compiler" },
    history: [],
    state: {},
  };
}

// ── Recording ──

export async function recordHandler(
  handlerFn: (ctx: unknown) => Promise<unknown>,
  handlerName: string = "unknown",
): Promise<ExecutionTrace> {
  const loopCaptures: LoopCapture[] = [];
  const delegate: ActionDelegate = { ctx: null! };
  const mockCtx = buildMockContext(delegate, loopCaptures);

  const sandbox = patchGlobals();

  try {
    // Phase A: run until classify (or completion)
    const phaseANodes: IRNode[] = [];
    const phaseAEdges: IREdge[] = []; // FIX 2: array para data edges
    const phaseACreateId = createIdGenerator(handlerName);
    let classifyCapture: ClassifyCapture | null = null;

    delegate.ctx = createRecordingContext(
      phaseANodes,
      phaseACreateId,
      {
        onClassify: (capture) => {
          classifyCapture = capture;
        },
        handlerName,
      },
      phaseAEdges,
    ); // FIX 2: pasar edges

    try {
      await handlerFn(mockCtx);
    } catch (err) {
      if (!(err instanceof ClassifySentinel)) throw err;
      classifyCapture = err.capture;
    }

    // No classify → linear trace
    if (!classifyCapture) {
      return {
        kind: "linear",
        nodes: phaseANodes,
        edges: phaseAEdges,
        loopCaptures,
      };
    }

    const preTraceLength = phaseANodes.length;
    const preNodes = [...phaseANodes];

    // Phase B: one pass per label
    const branches = new Map<string, IRNode[]>();
    const branchLoopCaptures = new Map<string, LoopCapture[]>();

    for (const label of classifyCapture.labels) {
      const passNodes: IRNode[] = [];
      const passLoops: LoopCapture[] = []; // Fresh loop array for this branch
      const passCreateId = createIdGenerator(`${handlerName}_branch_${label}`);
      let passClassifyHit = false;

      // Build new mock context with fresh loop captures for this branch
      const passMockCtx = buildMockContext(delegate, passLoops);

      delegate.ctx = createRecordingContext(passNodes, passCreateId, {
        classifyReturn: label,
        onClassify: () => {
          passClassifyHit = true;
        },
      });

      await handlerFn(passMockCtx);

      if (!passClassifyHit) {
        throw new CompileError(
          `Branch "${label}": classify was not reached during multi-pass recording.`,
        );
      }

      const passPreTrace = passNodes.slice(0, preTraceLength);
      const postTrace = passNodes.slice(preTraceLength);

      assertDeterministic(preNodes, passPreTrace, label);

      branches.set(label, postTrace);
      branchLoopCaptures.set(label, passLoops);
    }

    return {
      kind: "branching",
      preNodes,
      edges: phaseAEdges, // FIX 2: incluir edges de fase A
      classify: classifyCapture,
      branches,
      loopCaptures,
    };
  } finally {
    restoreGlobals(sandbox);
  }
}
