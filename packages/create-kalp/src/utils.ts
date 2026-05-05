import { resolve } from "node:path";
import { readdir, access } from "node:fs/promises";

/**
 * Checks if a directory contains an existing Kalp project.
 */
export async function isExistingKalpProject(dir: string): Promise<boolean> {
  try {
    await access(resolve(dir, "kalp.config.ts"));
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks if a directory is empty.
 */
export async function isDirEmpty(dir: string): Promise<boolean> {
  try {
    const entries = await readdir(dir);
    return entries.length === 0;
  } catch {
    return true;
  }
}

/**
 * Validates project structure for adding a new agent.
 */
export async function validateProjectForAddAgent(dir: string): Promise<{
  valid: boolean;
  missing: string[];
}> {
  const checks = [
    { path: resolve(dir, "kalp.config.ts"), name: "kalp.config.ts" },
    { path: resolve(dir, "agents"), name: "agents/" },
  ];

  const missing: string[] = [];
  for (const check of checks) {
    try {
      await access(check.path);
    } catch {
      missing.push(check.name);
    }
  }

  return { valid: missing.length === 0, missing };
}
