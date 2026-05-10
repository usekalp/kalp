import { chmod, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const GLOBAL_CONFIG_DIR = join(homedir(), ".config", "kalp");

export function getGlobalConfigDir(): string {
  return GLOBAL_CONFIG_DIR;
}

export async function ensureGlobalConfigDir(): Promise<string> {
  await mkdir(GLOBAL_CONFIG_DIR, { recursive: true, mode: 0o700 });

  if (process.platform !== "win32") {
    await chmod(GLOBAL_CONFIG_DIR, 0o700);
  }

  return GLOBAL_CONFIG_DIR;
}
