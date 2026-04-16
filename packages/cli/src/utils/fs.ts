import { access, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { execSync } from "node:child_process";

export async function isProjectInitialized(cwd: string): Promise<boolean> {
  try {
    await access(join(cwd, "kalp.config.ts"));
    return true;
  } catch {
    return false;
  }
}

export async function ensureConfig(cwd: string): Promise<void> {
  const initialized = await isProjectInitialized(cwd);
  if (!initialized) {
    throw new Error("kalp.config.ts not found");
  }
}

export async function ensureDirectory(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

export async function installDeps(cwd: string): Promise<void> {
  try {
    execSync("npx --no-install nci", {
      cwd,
      stdio: "pipe",
    });
  } catch {
    execSync("npm install", {
      cwd,
      stdio: "pipe",
    });
  }
}
