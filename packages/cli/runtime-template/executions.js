import {
  readExecutionEvents,
  readExecutionIndex,
  readExecutionSummary,
  writeExecutionEvents,
  writeExecutionIndex,
  writeExecutionSummary,
} from "./storage.js";
import { inferTextFromAgentResponse, makeId, summarizeValue, toIsoDate } from "./shared.js";

async function appendExecutionIndex(env, agentName, executionId) {
  const current = await readExecutionIndex(env, agentName);
  const next = [executionId, ...current.filter((item) => item !== executionId)].slice(0, 100);
  await writeExecutionIndex(env, agentName, next);
}

export async function recordExecution(env, params) {
  const {
    agentName,
    source,
    input,
    run,
  } = params;

  const executionId = makeId("exec");
  const startedAt = new Date().toISOString();
  const events = [
    {
      id: makeId("evt"),
      executionId,
      type: "execution_started",
      timestamp: startedAt,
      payload: {
        agentName,
        source,
        inputSummary: summarizeValue(input),
      },
    },
    {
      id: makeId("evt"),
      executionId,
      type: "node_started",
      timestamp: startedAt,
      payload: {
        source,
      },
    },
  ];

  const baseSummary = {
    id: executionId,
    agentName,
    trigger: source,
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
        type: "node_completed",
        timestamp: finishedAt,
        payload: {
          status: "completed",
        },
      },
      {
        id: makeId("evt"),
        executionId,
        type: "tool_result",
        timestamp: finishedAt,
        payload: {
          summary: summarizeValue(output),
        },
      },
      {
        id: makeId("evt"),
        executionId,
        type: "execution_finished",
        timestamp: finishedAt,
        payload: {
          status: "completed",
        },
      },
    );
    await writeExecutionSummary(env, agentName, executionId, completed);
    await writeExecutionEvents(env, agentName, executionId, events);
    return { executionId, output };
  } catch (error) {
    const finishedAt = new Date().toISOString();
    const failed = {
      ...baseSummary,
      status: "error",
      endedAt: finishedAt,
      durationMs: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
    };
    events.push({
      id: makeId("evt"),
      executionId,
      type: "node_completed",
      timestamp: finishedAt,
      payload: {
        status: "error",
      },
    });
    events.push({
      id: makeId("evt"),
      executionId,
      type: "error",
      timestamp: finishedAt,
      payload: {
        message: failed.error,
      },
    });
    await writeExecutionSummary(env, agentName, executionId, failed);
    await writeExecutionEvents(env, agentName, executionId, events);
    throw error;
  }
}

export async function readExecutionBundle(env, agentName, executionId) {
  const [summary, events] = await Promise.all([
    readExecutionSummary(env, agentName, executionId),
    readExecutionEvents(env, agentName, executionId),
  ]);
  return { summary, events };
}
