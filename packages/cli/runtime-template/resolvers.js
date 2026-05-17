import {
  readAgentIndex,
  readLatestHash,
  readSchemas,
  readSemanticIr,
  listAgentNamesFromKv,
  readChatSessions,
  readExecutionIndex,
  readExecutionSummary,
  readExecutionEvents as readExecutionEventsFromStore,
} from "./storage.js";

function normalizeTags(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

function normalizeNodeCollection(semanticIr) {
  return Object.values(semanticIr?.nodes ?? {}).filter(
    (node) => node && typeof node === "object" && typeof node.id === "string",
  );
}

function normalizeStableName(value) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function routeModel(node) {
  return {
    id: node.id,
    stableName: normalizeStableName(node.stableName),
    name: typeof node.name === "string" ? node.name : undefined,
    method: node.http?.method ?? node.trigger?.method ?? "GET",
    path: node.http?.path ?? node.trigger?.path ?? "/",
    public: Boolean(node.http?.skipAuth),
  };
}

function contractModel(node) {
  return {
    id: node.id,
    stableName: normalizeStableName(node.stableName),
    name: typeof node.name === "string" ? node.name : node.trigger?.contractName,
  };
}

function listenerModel(node) {
  return {
    id: node.id,
    stableName: normalizeStableName(node.stableName),
    event: node.listener?.event ?? node.trigger?.event ?? node.name ?? "listener",
    name: typeof node.name === "string" ? node.name : undefined,
  };
}

function triggerModel(node) {
  if (node.kind === "cron") {
    return {
      id: node.id,
      stableName: normalizeStableName(node.stableName),
      type: "schedule",
      expression: node.schedule?.expression ?? "",
      timezone: node.schedule?.timezone ?? "UTC",
    };
  }
  if (node.kind === "listener") {
    return {
      id: node.id,
      stableName: normalizeStableName(node.stableName),
      type: "listener",
      event: node.listener?.event ?? node.trigger?.event ?? node.name ?? "listener",
    };
  }
  if (node.kind === "message" || node.kind === "init" || node.kind === "tick") {
    return {
      id: node.id,
      stableName: normalizeStableName(node.stableName),
      type: "hook",
      event: node.kind,
    };
  }
  return null;
}

function entrypointModel(node) {
  if (node.kind === "route") {
    return {
      id: node.id,
      stableName: normalizeStableName(node.stableName),
      kind: "route",
      title: typeof node.name === "string" ? node.name : node.http?.path ?? node.id,
      method: node.http?.method ?? node.trigger?.method ?? "GET",
      path: node.http?.path ?? node.trigger?.path ?? "/",
    };
  }
  if (node.kind === "contract") {
    return {
      id: node.id,
      stableName: normalizeStableName(node.stableName),
      kind: "contract",
      title: typeof node.name === "string" ? node.name : node.id,
    };
  }
  if (node.kind === "listener") {
    return {
      id: node.id,
      stableName: normalizeStableName(node.stableName),
      kind: "listener",
      title: node.listener?.event ?? node.name ?? node.id,
    };
  }
  if (node.kind === "message" || node.kind === "init" || node.kind === "tick") {
    return {
      id: node.id,
      stableName: normalizeStableName(node.stableName),
      kind: "hook",
      title: node.kind,
    };
  }
  return null;
}

export async function resolveRuntimeSystemStatus(env) {
  const agentNames = await listAgentNamesFromKv(env);
  return {
    runtimeMode: env.KALP_ENV === "remote" ? "remote" : "local",
    studioMode: env.KALP_STUDIO_DEV_ORIGIN ? "live-workspace" : "bundled-artifact",
    agentCount: agentNames.length,
    supportsChat: true,
    supportsReplay: true,
    supportsState: true,
    supportsSubscriptions: {
      agents: "polling",
      state: "polling",
      executions: "polling",
      executionEvents: "polling",
      chatSession: "polling",
    },
  };
}

export async function resolveAgentMetadata(env, agentName, requestUrl) {
  const indexed = await readAgentIndex(env);
  const indexedEntry = indexed.find((entry) => entry?.name === agentName) ?? null;
  const latestHash = await readLatestHash(env, agentName);
  const semantic = latestHash ? await readSemanticIr(env, agentName, latestHash) : null;
  const metadata = semantic?.semanticIr?.agent ?? {};
  const requirements =
    semantic?.semanticIr?.requirements && typeof semantic.semanticIr.requirements === "object"
      ? semantic.semanticIr.requirements
      : {};
  return {
    name: agentName,
    label:
      typeof metadata.label === "string"
        ? metadata.label
        : typeof indexedEntry?.label === "string"
          ? indexedEntry.label
          : agentName,
    description:
      typeof metadata.description === "string" ? metadata.description : undefined,
    tags: normalizeTags(metadata.tags ?? indexedEntry?.tags),
    environment: env.KALP_ENV === "remote" ? "remote" : "local",
    status: latestHash ? "online" : "offline",
    hash: latestHash ?? null,
    version: typeof indexedEntry?.version === "string" ? indexedEntry.version : null,
    versionNumber:
      typeof indexedEntry?.versionNumber === "number" ? indexedEntry.versionNumber : null,
    lastRemoteHash: latestHash ?? null,
    lastLocalHash: latestHash ?? null,
    workerUrl: `${new URL(requestUrl).origin.replace(/\/$/, "")}/a/${agentName}`,
    localPath: typeof indexedEntry?.localPath === "string" ? indexedEntry.localPath : null,
    updatedAt: typeof indexedEntry?.updatedAt === "string" ? indexedEntry.updatedAt : null,
    public: Boolean(metadata.skipAuth),
    requirements,
    systemPrompt:
      typeof metadata.systemPrompt === "string" ? metadata.systemPrompt : undefined,
    stateSchema: typeof metadata.stateSchema === "string" ? metadata.stateSchema : undefined,
  };
}

export async function resolveRoutingTable(env, agentName) {
  const semantic = await readSemanticIr(env, agentName);
  if (!semantic) return [];
  return normalizeNodeCollection(semantic.semanticIr)
    .filter((node) => node.kind === "route")
    .map(routeModel);
}

export async function resolveContracts(env, agentName) {
  const semantic = await readSemanticIr(env, agentName);
  if (!semantic) return [];
  return normalizeNodeCollection(semantic.semanticIr)
    .filter((node) => node.kind === "contract")
    .map(contractModel);
}

export async function resolveEntrypoints(env, agentName) {
  const semantic = await readSemanticIr(env, agentName);
  if (!semantic) return [];
  return normalizeNodeCollection(semantic.semanticIr)
    .map(entrypointModel)
    .filter(Boolean);
}

export async function resolveTriggers(env, agentName) {
  const semantic = await readSemanticIr(env, agentName);
  if (!semantic) return [];
  return normalizeNodeCollection(semantic.semanticIr)
    .map(triggerModel)
    .filter(Boolean);
}

export async function resolveListeners(env, agentName) {
  const semantic = await readSemanticIr(env, agentName);
  if (!semantic) return [];
  return normalizeNodeCollection(semantic.semanticIr)
    .filter((node) => node.kind === "listener")
    .map(listenerModel);
}

export async function resolveAgentChatCapabilities(env, agentName) {
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

export async function resolveAgentState(env, agentName) {
  const semantic = await readSemanticIr(env, agentName);
  const schemasPayload = await readSchemas(env, agentName);
  const executionIds = await readExecutionIndex(env, agentName);
  const chatSessions = await readChatSessions(env, agentName);
  const latestExecutionId = executionIds[0];
  const latestExecution = latestExecutionId
    ? await readExecutionSummary(env, agentName, latestExecutionId)
    : null;
  const stateSchemaId = semantic?.semanticIr?.agent?.stateSchema;
  const schema = stateSchemaId ? schemasPayload?.schemas?.[stateSchemaId] ?? null : null;
  return {
    agentName,
    schemaId: stateSchemaId ?? null,
    schema: schema?.schema ?? null,
    snapshot: null,
    availability: {
      supported: false,
      reason: "The current runtime executor does not persist deterministic state snapshots yet.",
    },
    summary: [
      {
        key: "schema",
        value: stateSchemaId ?? "none",
      },
      {
        key: "executions",
        value: String(executionIds.length),
      },
      {
        key: "chat_sessions",
        value: String(chatSessions.length),
      },
      {
        key: "last_execution",
        value: latestExecution?.startedAt ?? "never",
      },
    ],
    updatedAt: latestExecution?.endedAt ?? latestExecution?.startedAt ?? null,
  };
}

export async function resolveExecutionSummaries(env, agentName) {
  const executionIds = await readExecutionIndex(env, agentName);
  const summaries = [];
  for (const executionId of executionIds) {
    const summary = await readExecutionSummary(env, agentName, executionId);
    if (summary) summaries.push(summary);
  }
  return summaries.sort((a, b) =>
    String(b.startedAt ?? "").localeCompare(String(a.startedAt ?? "")),
  );
}

export async function resolveExecutionEvents(env, agentName, executionId) {
  return readExecutionEventsFromStore(env, agentName, executionId);
}

export async function resolveChatSessions(env, agentName) {
  const sessions = await readChatSessions(env, agentName);
  return sessions.sort((a, b) =>
    String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")),
  );
}

export async function resolveAgentDetails(env, agentName, requestUrl) {
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
    executionStats: {
      total: executions.length,
      latest: executions[0] ?? null,
      running: executions.filter((execution) => execution.status === "running").length,
      failed: executions.filter((execution) => execution.status === "error").length,
    },
  };
}
