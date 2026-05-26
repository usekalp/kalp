import { readSemanticIr } from "@/kv-storage";
import { normalizeNodeCollection, routeModel, contractModel, entrypointModel, triggerModel, listenerModel } from "./models";

type EnvWithKv = { KALP_MANIFESTS: KVNamespace };

export async function resolveRoutingTable(env: EnvWithKv, agentName: string) {
  const semantic = await readSemanticIr(env, agentName);
  if (!semantic) return [];
  return normalizeNodeCollection(semantic.semanticIr)
    .filter((node) => node.kind === "route")
    .map(routeModel);
}

export async function resolveContracts(env: EnvWithKv, agentName: string) {
  const semantic = await readSemanticIr(env, agentName);
  if (!semantic) return [];
  return normalizeNodeCollection(semantic.semanticIr)
    .filter((node) => node.kind === "contract")
    .map(contractModel);
}

export async function resolveEntrypoints(env: EnvWithKv, agentName: string) {
  const semantic = await readSemanticIr(env, agentName);
  if (!semantic) return [];
  return normalizeNodeCollection(semantic.semanticIr)
    .map(entrypointModel)
    .filter(Boolean);
}

export async function resolveTriggers(env: EnvWithKv, agentName: string) {
  const semantic = await readSemanticIr(env, agentName);
  if (!semantic) return [];
  return normalizeNodeCollection(semantic.semanticIr)
    .map(triggerModel)
    .filter(Boolean);
}

export async function resolveListeners(env: EnvWithKv, agentName: string) {
  const semantic = await readSemanticIr(env, agentName);
  if (!semantic) return [];
  return normalizeNodeCollection(semantic.semanticIr)
    .filter((node) => node.kind === "listener")
    .map(listenerModel);
}