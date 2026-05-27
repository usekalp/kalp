import { readSemanticIr, readSchemas, readExecutionIndex, readExecutionSummary, readChatSessions as readChatSessionsFromKv, readExecutionEvents, readSourceMetadata } from "@/kv-storage";
import { normalizeNodeCollection } from "./models";
import { resolveAgentMetadata } from "./system";
import { resolveRoutingTable, resolveEntrypoints, resolveTriggers, resolveContracts, resolveListeners } from "./topology";

type EnvWithKv = { KALP_MANIFESTS: KVNamespace };

export async function resolveAgentChatCapabilities(
  env: EnvWithKv,
  agentName: string,
) {
  const semantic = await readSemanticIr(env, agentName);
  if (!semantic) {
    return {
      supportsChat: false,
      supportsStreaming: false,
      supportsAttachments: false,
      supportsHistory: true,
    };
  }
  const hasMessageHook = normalizeNodeCollection(semantic.semanticIr).some(
    (node) => node.kind === "message",
  );
  return {
    supportsChat: hasMessageHook,
    supportsStreaming: false,
    supportsAttachments: false,
    supportsHistory: true,
  };
}

export async function resolveAgentState(env: EnvWithKv, agentName: string) {
  const semantic = await readSemanticIr(env, agentName);
  const schemasPayload = await readSchemas(env, agentName);
  const executionIds = await readExecutionIndex(env, agentName);
  const chatSessions = await readChatSessionsFromKv<Record<string, unknown>>(env, agentName);
  const latestExecutionId = executionIds[0];
  const latestExecution = latestExecutionId
    ? await readExecutionSummary<Record<string, unknown>>(env, agentName, latestExecutionId)
    : null;
  const stateSchemaId = semantic?.semanticIr
    ? ((
        (semantic.semanticIr as Record<string, unknown>).agent as
          | Record<string, unknown>
          | undefined
      )?.stateSchema as string | undefined)
    : undefined;
  const schema = stateSchemaId
    ? ((
        schemasPayload?.schemas as
          | Record<string, Record<string, unknown>>
          | undefined
      )?.[stateSchemaId]?.schema ?? null)
    : null;
  return {
    agentName,
    schemaId: stateSchemaId ?? null,
    schema: schema ?? null,
    snapshot: null,
    availability: {
      supported: false,
      reason:
        "The current runtime executor does not persist deterministic state snapshots yet.",
    },
    summary: [
      { key: "schema", value: stateSchemaId ?? "none" },
      { key: "executions", value: String(executionIds.length) },
      { key: "chat_sessions", value: String(chatSessions.length) },
      {
        key: "last_execution",
        value:
          ((latestExecution as Record<string, unknown> | null)
            ?.startedAt as string) ?? "never",
      },
    ],
    updatedAt: ((latestExecution as Record<string, unknown> | null)?.endedAt ??
      (latestExecution as Record<string, unknown> | null)?.startedAt ??
      null) as string | null,
  };
}

export async function resolveChatSessions(env: EnvWithKv, agentName: string) {
  const sessions = await readChatSessionsFromKv<Record<string, unknown>>(env, agentName);
  return sessions.sort((a, b) =>
    String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")),
  );
}

export async function resolveExecutionSummaries(
  env: EnvWithKv,
  agentName: string,
) {
  const executionIds = await readExecutionIndex(env, agentName);
  const summaries: Record<string, unknown>[] = [];
  for (const executionId of executionIds) {
    const summary = await readExecutionSummary<Record<string, unknown>>(env, agentName, executionId);
    if (summary) summaries.push(summary);
  }
  return summaries.sort((a, b) =>
    String(b.startedAt ?? "").localeCompare(String(a.startedAt ?? "")),
  );
}

export async function resolveExecutionEvents(
  env: EnvWithKv,
  agentName: string,
  executionId: string,
) {
  return readExecutionEvents(env, agentName, executionId);
}

export async function resolveAgentDetails(
  env: EnvWithKv,
  agentName: string,
  requestUrl: string,
) {
  const [
    metadata,
    routes,
    entrypoints,
    triggers,
    contracts,
    listeners,
    state,
    chat,
    chatSessions,
    executions,
    sourceMetadata,
  ] = await Promise.all([
    resolveAgentMetadata(env, agentName, requestUrl),
    resolveRoutingTable(env, agentName),
    resolveEntrypoints(env, agentName),
    resolveTriggers(env, agentName),
    resolveContracts(env, agentName),
    resolveListeners(env, agentName),
    resolveAgentState(env, agentName),
    resolveAgentChatCapabilities(env, agentName),
    resolveChatSessions(env, agentName),
    resolveExecutionSummaries(env, agentName),
    readSourceMetadata(env, agentName),
  ]);

  return {
    ...metadata,
    routes,
    entrypoints,
    triggers,
    contracts,
    listeners,
    state,
    chat,
    chatSessions,
    sourceMetadata,
    executionStats: {
      total: (executions as Record<string, unknown>[]).length,
      latest: (executions as Record<string, unknown>[])[0] ?? null,
      running: (executions as Record<string, unknown>[]).filter(
        (e) => e.status === "running",
      ).length,
      failed: (executions as Record<string, unknown>[]).filter(
        (e) => e.status === "error",
      ).length,
    },
  };
}