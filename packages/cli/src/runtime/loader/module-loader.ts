import { createHash } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { LoadedModule } from "./types";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 50;

export class ModuleLoader {
  private static cacheDir: string | null = null;

  static async load(nodeId: string, code: string): Promise<LoadedModule> {
    const hash = createHash("sha256").update(code).digest("hex").slice(0, 12);
    const cacheDir = await this.ensureCacheDir();
    const filePath = join(cacheDir, `${nodeId}-${hash}.mjs`);

    try {
      const mod = await import(`file://${filePath}`);
      return this.wrapModule(mod);
    } catch {
      // Cache miss
    }

    await writeFile(filePath, code, "utf-8");

    let lastError: Error | undefined;
    for (let i = 0; i < MAX_RETRIES; i++) {
      try {
        const importUrl = `file://${filePath}?t=${Date.now()}`;
        const mod = await import(importUrl);
        return this.wrapModule(mod);
      } catch (err) {
        lastError = err as Error;
        if (i < MAX_RETRIES - 1) {
          await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
        }
      }
    }

    throw lastError ?? new Error(`Failed to load module "${nodeId}"`);
  }

  static async loadMany(
    entries: Array<{ nodeId: string; code: string }>,
  ): Promise<Map<string, LoadedModule>> {
    const results = await Promise.all(
      entries.map(async ({ nodeId, code }) => {
        const mod = await this.load(nodeId, code);
        return [nodeId, mod] as const;
      }),
    );
    return new Map(results);
  }

  private static wrapModule(mod: unknown): LoadedModule {
    const obj = mod as Record<string, unknown>;
    return {
      module: mod,
      defaultExport: (obj.default ?? mod) as Function,
      exports: { ...obj },
      loadedAt: new Date(),
    };
  }

  private static async ensureCacheDir(): Promise<string> {
    if (!this.cacheDir) {
      this.cacheDir = join(tmpdir(), "kalp-modules");
      await mkdir(this.cacheDir, { recursive: true });
    }
    return this.cacheDir;
  }
}
