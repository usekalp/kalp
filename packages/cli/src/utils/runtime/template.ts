import { access } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const RUNTIME_DIR = "runtime";
export const STUDIO_DIR = "studio";
export const WORKER_ENTRY_FILE = "worker.js";
export const WRANGLER_CONFIG_FILE = "wrangler.jsonc";

export interface RuntimeTemplatePaths {
  templateRoot: string;
  workerEntryPath: string;
  studioTemplateDir?: string;
}

function resolveMonorepoCloudflareDist(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const depth = here.includes(`dist${resolve("")[0]!}`) ? 3 : 4;
  return resolve(here, ...Array.from({ length: depth }, () => ".."), "packages", "cloudflare", "dist");
}

function resolveMonorepoStudioDist(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const depth = here.includes(`dist${resolve("")[0]!}`) ? 3 : 4;
  return resolve(here, ...Array.from({ length: depth }, () => ".."), "apps", "studio", "dist");
}

function resolveDistTemplateRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "runtime-template");
}

export function runtimeTemplateCandidates(
  studioMode: "bundled-artifact" | "live-workspace",
): RuntimeTemplatePaths[] {
  const distTemplateRoot = resolveDistTemplateRoot();
  const monorepoCloudflare = resolveMonorepoCloudflareDist();
  const monorepoStudio = resolveMonorepoStudioDist();

  const candidates: RuntimeTemplatePaths[] = [];

  if (studioMode === "live-workspace") {
    candidates.push({
      templateRoot: monorepoCloudflare,
      workerEntryPath: join(monorepoCloudflare, WORKER_ENTRY_FILE),
      studioTemplateDir: resolve(monorepoStudio, "..", "public"),
    });
  }

  candidates.push({
    templateRoot: distTemplateRoot,
    workerEntryPath: join(distTemplateRoot, WORKER_ENTRY_FILE),
    studioTemplateDir: join(distTemplateRoot, STUDIO_DIR),
  });

  candidates.push({
    templateRoot: monorepoCloudflare,
    workerEntryPath: join(monorepoCloudflare, WORKER_ENTRY_FILE),
    studioTemplateDir: monorepoStudio,
  });

  return candidates;
}

export async function resolveRuntimeTemplate(
  studioMode: "bundled-artifact" | "live-workspace",
): Promise<RuntimeTemplatePaths> {
  for (const candidate of runtimeTemplateCandidates(studioMode)) {
    try {
      await access(candidate.workerEntryPath);
      if (candidate.studioTemplateDir) {
        await access(candidate.studioTemplateDir);
      }
      return candidate;
    } catch {
      // continue
    }
  }

  throw new Error(
    "Kalp runtime template not found in CLI package. Reinstall @kalphq/cli.",
  );
}

import { cp, readdir } from "node:fs/promises";

export async function copyTemplateRootContents(
  templateRoot: string,
  runtimeDir: string,
): Promise<void> {
  const entries = await readdir(templateRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "studio") continue;
    const sourcePath = join(templateRoot, entry.name);
    const targetPath = join(runtimeDir, entry.name);
    await cp(sourcePath, targetPath, { recursive: true, force: true });
  }
}
