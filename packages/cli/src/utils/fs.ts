import { access } from "node:fs/promises";
import { join } from "node:path";

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
