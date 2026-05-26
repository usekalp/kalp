import {
  readExecutionEvents,
  readExecutionIndex,
  readExecutionSummary,
  writeExecutionEvents,
  writeExecutionIndex,
  writeExecutionSummary,
} from "@/kv-storage";
import { inferTextFromAgentResponse, makeId, summarizeValue } from "@/shared";

type EnvWithKv = { KALP_MANIFESTS: KVNamespace };

interface ExecutionParams {
  env: EnvWithKv;
  agentName: string;
  source: Record<string, unknown>;
  input: unknown;
  run: (ctx: { executionId: string }) => Promise<unknown>;
}

async function appendExecutionIndex(
  env: EnvWithKv,
  agentName: string,
  executionId: string,
): Promise<void> {
  const current = await readExecutionIndex(env, agentName);
  const next = [
    executionId,
    ...current.filter((item) => item !== executionId),
  ].slice(0, 100);
  await writeExecutionIndex(env, agentName, next);
}

export async function recordExecution(params: ExecutionParams) {
  const { env, agentName, source, input, run } = params;

  const executionId = makeId("exec");
  const threadId = (source as Record<string, unknown>).threadId as
    | string
    | undefined;
  const traceId = (source as Record<string, unknown>).traceId as
    | string
    | undefined;
  const startedAt = new Date().toISOString();
  const events: Array<Record<string, unknown>> = [
    {
      id: makeId("evt"),
      executionId,
      threadId: threadId ?? "system",
      traceId: traceId ?? executionId,
      type: "execution_started",
      timestamp: startedAt,
      payload: {
        agentName,
        source,
        inputSummary: summarizeValue(input),
      } as Record<string, unknown>,
    },
    {
      id: makeId("evt"),
      executionId,
      threadId: threadId ?? "system",
      traceId: traceId ?? executionId,
      type: "node_started",
      timestamp: startedAt,
      payload: { source } as Record<string, unknown>,
    },
  ];

  const baseSummary: Record<string, unknown> = {
    id: executionId,
    agentName,
    trigger: source,
    threadId: threadId ?? "system",
    traceId: traceId ?? executionId,
    status: "running",
    startedAt,
    endedAt: null,
    durationMs: null,
    error: null,
  };

  await writeExecutionSummary(env, agentName, executionId, baseSummary);
  await writeExecutionEvents(env, agentName, executionId, events);
  await appendExecutionIndex(env, agentName, executionId);

  const started = Date.now();
  try {
    const output = await run({ executionId });
    const finishedAt = new Date().toISOString();
    const completed = {
      ...baseSummary,
      status: "completed",
      endedAt: finishedAt,
      durationMs: Date.now() - started,
      outputText: inferTextFromAgentResponse(output),
    };
    events.push(
      {
        id: makeId("evt"),
        executionId,
        threadId: threadId ?? "system",
        traceId: traceId ?? executionId,
        type: "node_completed",
        timestamp: finishedAt,
        payload: { status: "completed" } as Record<string, unknown>,
      },
      {
        id: makeId("evt"),
        executionId,
        threadId: threadId ?? "system",
        traceId: traceId ?? executionId,
        type: "tool_result",
        timestamp: finishedAt,
        payload: { summary: summarizeValue(output) } as Record<string, unknown>,
      },
      {
        id: makeId("evt"),
        executionId,
        threadId: threadId ?? "system",
        traceId: traceId ?? executionId,
        type: "execution_finished",
        timestamp: finishedAt,
        payload: { status: "completed" } as Record<string, unknown>,
      },
    );
    await writeExecutionSummary(env, agentName, executionId, completed);
    await writeExecutionEvents(env, agentName, executionId, events);
    return { executionId, output };
  } catch (error: unknown) {
    const finishedAt = new Date().toISOString();
    const failed = {
      ...baseSummary,
      status: "error",
      endedAt: finishedAt,
      durationMs: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
    };
    events.push(
      {
        id: makeId("evt"),
        executionId,
        threadId: threadId ?? "system",
        traceId: traceId ?? executionId,
        type: "node_completed",
        timestamp: finishedAt,
        payload: { status: "error" } as Record<string, unknown>,
      },
      {
        id: makeId("evt"),
        executionId,
        threadId: threadId ?? "system",
        traceId: traceId ?? executionId,
        type: "error",
        timestamp: finishedAt,
        payload: { message: failed.error } as Record<string, unknown>,
      },
    );
    await writeExecutionSummary(env, agentName, executionId, failed);
    await writeExecutionEvents(env, agentName, executionId, events);
    throw error;
  }
}

export async function readExecutionBundle(
  env: EnvWithKv,
  agentName: string,
  executionId: string,
) {
  const [summary, events] = await Promise.all([
    readExecutionSummary(env, agentName, executionId),
    readExecutionEvents(env, agentName, executionId),
  ]);
  return { summary, events };
}