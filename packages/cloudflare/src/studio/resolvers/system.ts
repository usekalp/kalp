import { listAgentNamesFromKv, readAgentIndex, readLatestHash, readSemanticIr } from "@/kv-storage";
import { normalizeTags } from "./models";

type EnvWithKv = { KALP_MANIFESTS: KVNamespace };

export async function resolveRuntimeSystemStatus(env: EnvWithKv) {
  const agentNames = await listAgentNamesFromKv(env);
  return {
    runtimeMode:
      (env as Record<string, unknown>).KALP_ENV === "remote"
        ? "remote"
        : "local",
    studioMode: (env as Record<string, unknown>).KALP_STUDIO_DEV_ORIGIN
      ? "live-workspace"
      : "bundled-artifact",
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

export async function resolveAgentMetadata(
  env: EnvWithKv,
  agentName: string,
  requestUrl: string,
) {
  const indexed = await readAgentIndex(env);
  const indexedEntry =
    (indexed.find((entry) => entry?.name === agentName) as
      | Record<string, unknown>
      | undefined) ?? null;
  const latestHash = await readLatestHash(env, agentName);
  const semantic = latestHash
    ? await readSemanticIr(env, agentName, latestHash)
    : null;
  const metadata = (semantic?.semanticIr?.agent ?? {}) as Record<string, unknown>;
  return {
    name: agentName,
    label:
      typeof metadata.label === "string"
        ? metadata.label
        : typeof (indexedEntry as Record<string, unknown> | undefined)
              ?.label === "string"
          ? ((indexedEntry as Record<string, unknown>).label as string)
          : agentName,
    description:
      typeof metadata.description === "string"
        ? metadata.description
        : undefined,
    tags: normalizeTags(
      metadata.tags ??
        (indexedEntry as Record<string, unknown> | undefined)?.tags,
    ),
    environment:
      (env as Record<string, unknown>).KALP_ENV === "remote"
        ? "remote"
        : "local",
    status: latestHash ? "online" : "offline",
    hash: latestHash ?? null,
    version:
      typeof (indexedEntry as Record<string, unknown> | undefined)?.version ===
      "string"
        ? ((indexedEntry as Record<string, unknown>).version as string)
        : null,
    versionNumber:
      typeof (indexedEntry as Record<string, unknown> | undefined)
        ?.versionNumber === "number"
        ? ((indexedEntry as Record<string, unknown>).versionNumber as number)
        : null,
    lastRemoteHash: latestHash ?? null,
    lastLocalHash: latestHash ?? null,
    workerUrl: `${new URL(requestUrl).origin.replace(/\/$/, "")}/a/${agentName}`,
    localPath:
      typeof (indexedEntry as Record<string, unknown> | undefined)
        ?.localPath === "string"
        ? ((indexedEntry as Record<string, unknown>).localPath as string)
        : null,
    updatedAt:
      typeof (indexedEntry as Record<string, unknown> | undefined)
        ?.updatedAt === "string"
        ? ((indexedEntry as Record<string, unknown>).updatedAt as string)
        : null,
    public: Boolean(metadata.skipAuth),
    systemPrompt:
      typeof metadata.systemPrompt === "string"
        ? metadata.systemPrompt
        : undefined,
    stateSchema:
      typeof metadata.stateSchema === "string"
        ? metadata.stateSchema
        : undefined,
  };
}