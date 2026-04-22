import { mkdir } from "node:fs/promises";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export async function ensureDirectory(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

export async function installDeps(cwd: string): Promise<void> {
  try {
    await execAsync("npx --no-install nci", { cwd });
  } catch {
    await execAsync("npm install", { cwd });
  }
}
