import type { IRNode } from "@kalphq/sdk";
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
  loopCaptures: LoopCapture[];
}

export interface BranchingTrace {
  kind: "branching";
  preNodes: IRNode[];
  classify: ClassifyCapture;
  branches: Map<string, IRNode[]>;
  loopCaptures: LoopCapture[]; // Loops captured before classify (pre-classify loops)
  branchLoopCaptures: Map<string, LoopCapture[]>; // Loops captured per branch
}

export type ExecutionTrace = LinearTrace | BranchingTrace;

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
): Promise<ExecutionTrace> {
  const loopCaptures: LoopCapture[] = [];
  const delegate: ActionDelegate = { ctx: null! };
  const mockCtx = buildMockContext(delegate, loopCaptures);

  const sandbox = patchGlobals();

  try {
    // Phase A: run until classify (or completion)
    const phaseANodes: IRNode[] = [];
    const phaseACreateId = createIdGenerator();
    let classifyCapture: ClassifyCapture | null = null;

    delegate.ctx = createRecordingContext(phaseANodes, phaseACreateId, {
      onClassify: (capture) => {
        classifyCapture = capture;
      },
    });

    try {
      await handlerFn(mockCtx);
    } catch (err) {
      if (!(err instanceof ClassifySentinel)) throw err;
      classifyCapture = err.capture;
    }

    // No classify → linear trace
    if (!classifyCapture) {
      return { kind: "linear", nodes: phaseANodes, loopCaptures };
    }

    const preTraceLength = phaseANodes.length;
    const preNodes = [...phaseANodes];

    // Phase B: one pass per label
    const branches = new Map<string, IRNode[]>();
    const branchLoopCaptures = new Map<string, LoopCapture[]>();

    for (const label of classifyCapture.labels) {
      const passNodes: IRNode[] = [];
      const passLoops: LoopCapture[] = []; // Fresh loop array for this branch
      const passCreateId = createIdGenerator();
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
      classify: classifyCapture,
      branches,
      loopCaptures,
      branchLoopCaptures,
    };
  } finally {
    restoreGlobals(sandbox);
  }
}
