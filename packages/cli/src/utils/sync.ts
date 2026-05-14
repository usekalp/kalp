import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import pc from "picocolors";
import * as p from "@clack/prompts";

export interface GeneratorResult {
  updated: boolean;
  message?: string;
  warnings?: string[];
}

export interface ProjectGenerator {
  id: string;
  name: string;
  generate: (cwd: string) => Promise<GeneratorResult>;
}

export interface SyncManifest {
  version: number;
  generatedAt: string;
  generators: Record<string, {
    hash?: string;
    updatedAt: string;
  }>;
}

const MANIFEST_VERSION = 1;

export class ProjectSynchronizer {
  private generators = new Map<string, ProjectGenerator>();

  register(generator: ProjectGenerator) {
    this.generators.set(generator.id, generator);
    return this;
  }

  async run(cwd: string, options: { ids?: string[]; force?: boolean } = {}) {
    const generatedDir = join(cwd, ".kalp", "generated");
    await mkdir(generatedDir, { recursive: true });

    const manifestPath = join(generatedDir, "manifest.json");
    const manifest = await this.readManifest(manifestPath);

    const ids = options.ids || Array.from(this.generators.keys());
    const results: Record<string, GeneratorResult> = {};

    for (const id of ids) {
      const generator = this.generators.get(id);
      if (!generator) {
        console.warn(`[Sync] Generator "${id}" not found.`);
        continue;
      }

      try {
        const result = await generator.generate(cwd);
        results[id] = result;

        if (result.updated) {
          manifest.generators[id] = {
            updatedAt: new Date().toISOString(),
          };
        }
      } catch (error) {
        throw new Error(`Generator "${generator.name}" failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    manifest.generatedAt = new Date().toISOString();
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");

    return results;
  }

  private async readManifest(path: string): Promise<SyncManifest> {
    try {
      const content = await readFile(path, "utf-8");
      return JSON.parse(content) as SyncManifest;
    } catch {
      return {
        version: MANIFEST_VERSION,
        generatedAt: new Date().toISOString(),
        generators: {},
      };
    }
  }
}

/**
 * Global synchronizer instance.
 */
export const synchronizer = new ProjectSynchronizer();
