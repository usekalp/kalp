import fs from "node:fs";
import path from "node:path";

const STORE_FILE = path.join(process.cwd(), ".kalp-agent-store.json");

interface AgentVersion {
  agentName: string;
  hash: string;
  timestamp: string;
}

interface AgentStore {
  [agentName: string]: AgentVersion;
}

/**
 * Reads the agent store from disk.
 */
function readStore(): AgentStore {
  try {
    const data = fs.readFileSync(STORE_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    // File doesn't exist yet, return empty store
    return {};
  }
}

/**
 * Writes the agent store to disk.
 */
function writeStore(store: AgentStore): void {
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), "utf-8");
}

/**
 * Gets the current hash for an agent.
 * Returns null if agent doesn't exist.
 */
export function getAgentHash(agentName: string): string | null {
  const store = readStore();
  const version = store[agentName];
  return version?.hash ?? null;
}

/**
 * Stores a new agent version with its hash.
 */
export function storeAgentVersion(agentName: string, hash: string): void {
  const store = readStore();
  store[agentName] = {
    agentName,
    hash,
    timestamp: new Date().toISOString(),
  };
  writeStore(store);
}
