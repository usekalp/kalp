import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface ProjectAgentState {
  currentHash: string | null;
  currentVersion: number;
  lastLocalHash: string | null;
  lastRemoteHash: string | null;
  lastPushedAt: string | null;
  localPath: string;
  workerUrl: string | null;
}

export interface ProjectState {
  workerUrl: string | null;
  deployedAt: string | null;
  accountId: string | null;
  agents: Record<string, ProjectAgentState>;
}

const KALP_DIR = ".kalp";
const STATE_FILE = "state.json";

function normalizeProjectState(raw: unknown): ProjectState | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const workerUrl =
    typeof value.workerUrl === "string" && value.workerUrl.length > 0
      ? value.workerUrl
      : null;
  const deployedAt =
    typeof value.deployedAt === "string" && value.deployedAt.length > 0
      ? value.deployedAt
      : null;
  const accountId =
    typeof value.accountId === "string" && value.accountId.length > 0
      ? value.accountId
      : null;

  const agents: Record<string, ProjectAgentState> = {};
  const rawAgents =
    value.agents && typeof value.agents === "object"
      ? (value.agents as Record<string, unknown>)
      : {};

  for (const [name, entry] of Object.entries(rawAgents)) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Record<string, unknown>;
    if (typeof item.localPath !== "string" || item.localPath.length === 0) {
      continue;
    }

    const currentVersion =
      typeof item.currentVersion === "number" && Number.isFinite(item.currentVersion)
        ? Math.max(0, Math.floor(item.currentVersion))
        : 0;

    agents[name] = {
      currentHash: typeof item.currentHash === "string" ? item.currentHash : null,
      currentVersion,
      lastLocalHash: typeof item.lastLocalHash === "string" ? item.lastLocalHash : null,
      lastRemoteHash:
        typeof item.lastRemoteHash === "string" ? item.lastRemoteHash : null,
      lastPushedAt: typeof item.lastPushedAt === "string" ? item.lastPushedAt : null,
      localPath: item.localPath,
      workerUrl: typeof item.workerUrl === "string" ? item.workerUrl : null,
    };
  }

  return { workerUrl, deployedAt, accountId, agents };
}

export async function readProjectState(cwd: string): Promise<ProjectState | null> {
  try {
    const statePath = join(cwd, KALP_DIR, STATE_FILE);
    const content = await readFile(statePath, "utf-8");
    return normalizeProjectState(JSON.parse(content));
  } catch {
    return null;
  }
}

export async function writeProjectState(
  cwd: string,
  state: ProjectState,
): Promise<void> {
  const dir = join(cwd, KALP_DIR);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, STATE_FILE), `${JSON.stringify(state, null, 2)}\n`, "utf-8");
}
