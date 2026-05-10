import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface ProjectState {
  workerUrl: string;
  deployedAt: string;
  accountId: string;
}

const KALP_DIR = ".kalp";
const STATE_FILE = "state.json";

export async function readProjectState(cwd: string): Promise<ProjectState | null> {
  try {
    const statePath = join(cwd, KALP_DIR, STATE_FILE);
    const content = await readFile(statePath, "utf-8");
    return JSON.parse(content) as ProjectState;
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
  await writeFile(join(dir, STATE_FILE), JSON.stringify(state, null, 2), "utf-8");
}
