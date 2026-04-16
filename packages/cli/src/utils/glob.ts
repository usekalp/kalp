import { readdir, stat } from "node:fs/promises";
import { resolve, dirname } from "node:path";

export async function glob(pattern: string): Promise<string[]> {
  const normalized = pattern.replace(/\\/g, "/");
  const dir = dirname(dirname(normalized));
  const filename = normalized.split("/").pop() ?? "";

  const results: string[] = [];

  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const candidate = resolve(dir, entry.name, filename);
      try {
        const s = await stat(candidate);
        if (s.isFile()) results.push(candidate);
      } catch {
        // file doesn't exist in this subdirectory
      }
    }
  } catch {
    // parent directory doesn't exist
  }

  return results;
}
