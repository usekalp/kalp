import { rm, mkdir, cp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getRequiredAiSecrets } from "@/utils/ai";
import { resolveIdentityAuthRequirements } from "@/utils/project-config";
import { materializeRuntimeIdentity } from "@/utils/runtime-identity";
import {
  createRuntimeConfig,
  buildWorkerName,
  resolveProjectSlug,
  readExistingKvNamespaceIds,
  WORKER_ENTRY_FILE,
  WRANGLER_CONFIG_FILE,
} from "@/utils/runtime/wrangler-config";
import {
  resolveRuntimeTemplate,
  copyTemplateRootContents,
  RUNTIME_DIR,
  STUDIO_DIR,
} from "@/utils/runtime/template";
import {
  ensureStudioIndex,
  ensureLiveWorkspaceStudioPlaceholder,
} from "@/utils/runtime/studio-html";
import {
  writeRuntimeAgentsSnapshot,
} from "@/utils/runtime/agent-snapshot";

const RUNTIME_ROOT = ".kalp";

export interface RuntimePaths {
  runtimeDir: string;
  studioDir: string;
  workerEntrypointPath: string;
  wranglerConfigPath: string;
  workerName: string;
}

export interface MaterializeRuntimeOptions {
  mode?: "local" | "remote";
  studioMode?: "bundled-artifact" | "live-workspace";
}

export async function materializeRuntime(
  cwd: string,
  options: MaterializeRuntimeOptions = {},
): Promise<RuntimePaths> {
  const mode = options.mode ?? "remote";
  const studioMode =
    options.studioMode ?? (mode === "local" ? "live-workspace" : "bundled-artifact");
  const runtimeDir = join(cwd, RUNTIME_ROOT, RUNTIME_DIR);
  const studioDir = join(runtimeDir, STUDIO_DIR);
  const workerEntrypointPath = join(runtimeDir, WORKER_ENTRY_FILE);
  const wranglerConfigPath = join(runtimeDir, WRANGLER_CONFIG_FILE);

  const existingKvIds = await readExistingKvNamespaceIds(wranglerConfigPath);

  const template = await resolveRuntimeTemplate(studioMode);
  await rm(runtimeDir, { recursive: true, force: true });
  await mkdir(runtimeDir, { recursive: true });

  await copyTemplateRootContents(template.templateRoot, runtimeDir);
  await rm(studioDir, { recursive: true, force: true });
  if (template.studioTemplateDir) {
    await cp(template.studioTemplateDir, studioDir, { recursive: true }).catch(() => undefined);
  }
  if (studioMode === "live-workspace") {
    await ensureLiveWorkspaceStudioPlaceholder(studioDir);
  } else {
    await ensureStudioIndex(studioDir);
  }

  await writeRuntimeAgentsSnapshot({ cwd, runtimeDir, mode });
  const identity = await materializeRuntimeIdentity({ cwd, runtimeDir });

  const projectSlug = await resolveProjectSlug(cwd);
  const workerName = buildWorkerName(projectSlug, cwd);
  const requiredSecrets = new Set<string>([
    "KALP_SECRET_KEY",
    "KALP_STUDIO_PASSWORD",
    "KALP_STUDIO_ADMIN_USER",
    "KALP_SERVICE_KEY",
  ]);

  for (const secret of getRequiredAiSecrets()) {
    requiredSecrets.add(secret);
  }

  const identityRequirements = resolveIdentityAuthRequirements(identity.identityConfig);
  for (const requirement of identityRequirements) {
    requiredSecrets.add(requirement.envKey);
  }

  const wranglerConfig = createRuntimeConfig(
    workerName,
    mode,
    [...requiredSecrets].sort((a, b) => a.localeCompare(b)),
  );

  for (const kv of wranglerConfig.kv_namespaces) {
    const preserved = existingKvIds[kv.binding];
    if (preserved) kv.id = preserved;
  }

  await writeFile(
    wranglerConfigPath,
    `${JSON.stringify(wranglerConfig, null, 2)}\n`,
    "utf-8",
  );

  return {
    runtimeDir,
    studioDir: studioDir,
    workerEntrypointPath,
    wranglerConfigPath,
    workerName,
  };
}

export { readLocalAgentNames } from "@/utils/runtime/agent-snapshot";
