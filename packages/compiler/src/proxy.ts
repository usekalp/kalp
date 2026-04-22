import type {
  ClassifyIRNode,
  FetchIRNode,
  GenerateIRNode,
  IRNode,
  IRNodeId,
  RunIRNode,
  RunTargetKind,
  StreamIRNode,
  WaitIRNode,
} from "@kalphq/sdk";
import { createIdGenerator } from "@/ids";

// ─── Compile Error ───────────────────────────────────────────────────────────

export class CompileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CompileError";
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RecordingTrace {
  nodes: IRNode[];
}

export interface ClassifyCapture {
  labels: string[];
  model?: string;
  confidenceThreshold?: number;
  input: { text: string; labels: string[] };
}

export interface BranchingResult {
  preTrace: IRNode[];
  classify: ClassifyCapture;
  branches: Map<string, IRNode[]>;
}

export interface RecordingContext {
  actions: {
    run: (
      node: { id: string; kind?: string },
      input?: unknown,
    ) => Promise<unknown>;
    wait: (duration: string | number) => Promise<unknown>;
    fetch: (
      input: string | URL | Request,
      init?: RequestInit,
    ) => Promise<unknown>;
    loop: (body: () => Promise<void>) => void;
  };
  ai: {
    generate: (
      params: Record<string, unknown> & { model?: string },
    ) => Promise<unknown>;
    stream: (
      params: Record<string, unknown> & { model?: string },
    ) => Promise<unknown>;
    classify: (params: {
      input: string;
      labels: string[];
      model?: string;
      confidenceThreshold?: number;
    }) => Promise<string>;
  };
}

export type RecordingBody = (context: RecordingContext) => Promise<void> | void;

// ─── Compile-time Sandbox ────────────────────────────────────────────────────

interface SandboxState {
  originalFetch: typeof globalThis.fetch | undefined;
  originalDateNow: typeof Date.now | undefined;
  originalMathRandom: typeof Math.random | undefined;
}

const FIXED_TIMESTAMP = 1700000000000;

const patchGlobals = (): SandboxState => {
  const state: SandboxState = {
    originalFetch:
      typeof globalThis.fetch === "function" ? globalThis.fetch : undefined,
    originalDateNow: Date.now,
    originalMathRandom: Math.random,
  };

  (globalThis as any).fetch = () => {
    throw new CompileError(
      "Use actions.fetch() instead of global fetch during compilation.",
    );
  };

  Date.now = () => FIXED_TIMESTAMP;

  Math.random = () => {
    throw new CompileError(
      "Non-deterministic code not allowed in handler body. Avoid Math.random().",
    );
  };

  return state;
};

const restoreGlobals = (state: SandboxState): void => {
  if (state.originalFetch) {
    globalThis.fetch = state.originalFetch;
  }
  if (state.originalDateNow) {
    Date.now = state.originalDateNow;
  }
  if (state.originalMathRandom) {
    Math.random = state.originalMathRandom;
  }
};

// ─── Sentinel for stopping execution at classify ─────────────────────────────

class ClassifySentinel {
  constructor(public capture: ClassifyCapture) {}
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const toUrlString = (input: string | URL | Request): string => {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
};

const nodeFingerprint = (node: IRNode): string => {
  if (node.kind === "run") return `run:${(node as RunIRNode).targetId}`;
  if (node.kind === "wait") return `wait:${(node as WaitIRNode).duration}`;
  if (node.kind === "fetch") return `fetch:${(node as FetchIRNode).url}`;
  if (node.kind === "llm.generate") return `llm.generate`;
  if (node.kind === "llm.stream") return `llm.stream`;
  return node.kind;
};

const assertDeterministic = (
  reference: IRNode[],
  candidate: IRNode[],
  label: string,
): void => {
  if (reference.length !== candidate.length) {
    throw new CompileError(
      `Handler is non-deterministic before classify. ` +
        `Pre-classify trace has ${reference.length} nodes but branch "${label}" produced ${candidate.length}. ` +
        `Avoid Date.now(), Math.random(), or conditional logic before ai.classify().`,
    );
  }
  for (let i = 0; i < reference.length; i++) {
    const refFp = nodeFingerprint(reference[i]!);
    const candFp = nodeFingerprint(candidate[i]!);
    if (refFp !== candFp) {
      throw new CompileError(
        `Handler is non-deterministic before classify. ` +
          `Node ${i} differs: expected "${refFp}" but branch "${label}" produced "${candFp}". ` +
          `Avoid Date.now(), Math.random(), or conditional logic before ai.classify().`,
      );
    }
  }
};

// ─── Context Factory ─────────────────────────────────────────────────────────

interface EmitterConfig {
  classifyReturn?: string;
  onClassify?: (capture: ClassifyCapture) => void;
  simpleMode?: boolean;
}

const createRecordingContext = (
  nodes: IRNode[],
  createId: ReturnType<typeof createIdGenerator>,
  config: EmitterConfig = {},
): RecordingContext => {
  let classifyCount = 0;

  const emit = <T extends IRNode>(node: Omit<T, "id"> & { id?: IRNodeId }) => {
    const kind = node.kind as IRNode["kind"];
    const id = node.id ?? createId(kind.replaceAll(".", "_"));
    nodes.push({ ...node, id } as T);
    return id;
  };

  const actions: RecordingContext["actions"] = {
    run: async (node, input) => {
      emit<RunIRNode>({
        kind: "run",
        targetId: node.id,
        targetKind: (node.kind ?? "step") as RunTargetKind,
        input,
      });
      return undefined;
    },
    wait: async (duration) => {
      emit<WaitIRNode>({ kind: "wait", duration });
      return undefined;
    },
    fetch: async (input, init) => {
      emit<FetchIRNode>({ kind: "fetch", url: toUrlString(input), init });
      return undefined;
    },
    loop: () => {
      throw new CompileError(
        "Nested loop capture must be compiled via compileLoop.",
      );
    },
  };

  const ai: RecordingContext["ai"] = {
    generate: async (params) => {
      const { model, schema, ...input } = params;
      emit<GenerateIRNode>({ kind: "llm.generate", model, input, schema });
      return undefined;
    },
    stream: async (params) => {
      const { model, schema, ...input } = params;
      emit<StreamIRNode>({ kind: "llm.stream", model, input, schema });
      return undefined;
    },
    classify: async (params) => {
      if (config.simpleMode) {
        emit<ClassifyIRNode>({
          kind: "llm.classify",
          model: params.model,
          input: { text: params.input, labels: params.labels },
          branches: [],
          confidenceThreshold: params.confidenceThreshold,
        });
        return "" as string;
      }

      classifyCount += 1;
      if (classifyCount > 1) {
        throw new CompileError(
          "Only one ai.classify() per handler is supported.",
        );
      }

      const capture: ClassifyCapture = {
        labels: params.labels,
        model: params.model,
        confidenceThreshold: params.confidenceThreshold,
        input: { text: params.input, labels: params.labels },
      };

      if (config.onClassify) {
        config.onClassify(capture);
      }

      if (config.classifyReturn != null) {
        return config.classifyReturn;
      }

      throw new ClassifySentinel(capture);
    },
  };

  return { actions, ai };
};

// ─── Simple recording (no classify) ──────────────────────────────────────────

export const recordEmissions = async (
  body: RecordingBody,
): Promise<RecordingTrace> => {
  const nodes: IRNode[] = [];
  const createId = createIdGenerator();
  const ctx = createRecordingContext(nodes, createId, { simpleMode: true });
  await body(ctx);
  return { nodes };
};

// ─── Two-phase recording with multi-pass classify ────────────────────────────

export const recordWithBranching = async (
  body: RecordingBody,
): Promise<RecordingTrace | BranchingResult> => {
  const sandbox = patchGlobals();

  try {
    // ── Phase A: run until classify (or to completion) ──────────────────
    const phaseANodes: IRNode[] = [];
    const phaseACreateId = createIdGenerator();
    let classifyCapture: ClassifyCapture | null = null;

    const phaseACtx = createRecordingContext(phaseANodes, phaseACreateId, {
      onClassify: (capture) => {
        classifyCapture = capture;
      },
    });

    try {
      await body(phaseACtx);
    } catch (err) {
      if (!(err instanceof ClassifySentinel)) throw err;
      classifyCapture = err.capture;
    }

    // No classify → simple linear trace
    if (!classifyCapture) {
      return { nodes: phaseANodes };
    }

    const preTraceLength = phaseANodes.length;
    const preTrace = [...phaseANodes];

    // ── Phase B: one pass per label ────────────────────────────────────
    const branches = new Map<string, IRNode[]>();

    for (const label of classifyCapture.labels) {
      const passNodes: IRNode[] = [];
      const passCreateId = createIdGenerator();
      let passClassifyHit = false;

      const passCtx = createRecordingContext(passNodes, passCreateId, {
        classifyReturn: label,
        onClassify: () => {
          passClassifyHit = true;
        },
      });

      await body(passCtx);

      if (!passClassifyHit) {
        throw new CompileError(
          `Branch "${label}": classify was not reached during multi-pass recording.`,
        );
      }

      // Split pre/post classify
      const passPreTrace = passNodes.slice(0, preTraceLength);
      const postTrace = passNodes.slice(preTraceLength);

      // Structural determinism check
      assertDeterministic(preTrace, passPreTrace, label);

      branches.set(label, postTrace);
    }

    return { preTrace, classify: classifyCapture, branches };
  } finally {
    restoreGlobals(sandbox);
  }
};
