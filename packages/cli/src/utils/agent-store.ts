import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ensureGlobalConfigDir } from "@/utils/config";

export interface AgentStoreEntry {
  hash: string;
  timestamp: string;
  workerUrl: string;
  localPath: string;
}

export type AgentStore = Record<string, AgentStoreEntry>;

async function getStorePath(): Promise<string> {
  return join(await ensureGlobalConfigDir(), "agents.json");
}

export async function readAgentStore(): Promise<AgentStore> {
  try {
    const storePath = await getStorePath();
    const content = await readFile(storePath, "utf-8");
    return JSON.parse(content) as AgentStore;
  } catch {
    return {};
  }
}

export async function getAgentStoreEntry(
  agentName: string,
): Promise<AgentStoreEntry | null> {
  const store = await readAgentStore();
  return store[agentName] ?? null;
}

export async function writeAgentStoreEntry(
  agentName: string,
  entry: AgentStoreEntry,
): Promise<void> {
  const storePath = await getStorePath();
  const store = await readAgentStore();
  store[agentName] = entry;
  await writeFile(storePath, JSON.stringify(store, null, 2), "utf-8");
}
