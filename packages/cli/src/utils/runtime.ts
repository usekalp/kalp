import { createHash } from "node:crypto";
import {
  access,
  cp,
  mkdir,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deriveLabelFromName } from "@kalphq/project";
import { getRequiredSecretForProvider, resolveProviderFromConfig } from "@/utils/ai";
import {
  resolveIdentityAuthRequirements,
} from "@/utils/project-config";
import { readProjectState } from "@/utils/project-state";
import { materializeRuntimeIdentity } from "@/utils/runtime-identity";

const RUNTIME_ROOT = ".kalp";
const RUNTIME_DIR = "runtime";
const STUDIO_DIR = "studio";
const WRANGLER_CONFIG_FILE = "wrangler.jsonc";
const WORKER_ENTRY_FILE = "worker-entry.js";
const COMPATIBILITY_DATE = "2026-05-10";

export interface RuntimePaths {
  runtimeDir: string;
  studioDir: string;
  workerEntrypointPath: string;
  wranglerConfigPath: string;
  workerName: string;
}

interface RuntimeAgentRecord {
  name: string;
  label?: string;
  tags?: string[];
  environment: "local" | "remote" | "both";
  status: "online" | "offline";
  hash: string | null;
  version: string | null;
  versionNumber: number | null;
  lastRemoteHash: string | null;
  lastLocalHash: string | null;
  workerUrl: string | null;
  localPath: string | null;
  updatedAt: string | null;
}

interface RuntimeAgentsSnapshot {
  generatedAt: string;
  projectPath: string;
  workerUrl: string | null;
  mode: "local" | "remote";
  agents: RuntimeAgentRecord[];
}

export interface MaterializeRuntimeOptions {
  mode?: "local" | "remote";
}

interface WranglerConfig {
  $schema: string;
  name: string;
  main: string;
  compatibility_date: string;
  compatibility_flags: string[];
  migrations: Array<{ tag: string; new_sqlite_classes: string[] }>;
  durable_objects: {
    bindings: Array<{ name: string; class_name: string }>;
  };
  kv_namespaces: Array<{ binding: string }>;
  assets: {
    directory: string;
    binding: string;
    run_worker_first: boolean;
  };
  observability: { enabled: boolean };
  upload_source_maps: boolean;
  vars: {
    KALP_ENV: "local" | "remote";
  };
  secrets: { required: string[] };
}

interface RuntimeTemplatePaths {
  studioTemplateDir: string;
  workerEntryPath: string;
}

function sanitizeSegment(input: string): string {
  return input
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/\//g, "-")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function resolveProjectSlug(cwd: string): Promise<string> {
  const fallback = sanitizeSegment(basename(cwd)) || "agent";
  const packageJsonPath = join(cwd, "package.json");

  try {
    const content = await readFile(packageJsonPath, "utf-8");
    const pkg = JSON.parse(content) as { name?: string };
    const name = typeof pkg.name === "string" ? pkg.name : "";
    const sanitized = sanitizeSegment(name);
    return sanitized || fallback;
  } catch {
    return fallback;
  }
}

function buildWorkerName(slug: string, cwd: string): string {
  const cwdHash = createHash("sha1").update(cwd).digest("hex").slice(0, 8);
  const withPrefix = `kalp-${slug}-${cwdHash}`;
  const maxLen = 63;
  if (withPrefix.length <= maxLen) {
    return withPrefix;
  }

  const clipped = withPrefix.slice(0, maxLen).replace(/-+$/g, "");
  return clipped || `kalp-${cwdHash}`;
}

function createRuntimeConfig(
  workerName: string,
  mode: "local" | "remote",
  requiredSecrets: string[],
): WranglerConfig {
  return {
    $schema: "node_modules/wrangler/config-schema.json",
    name: workerName,
    main: `./${WORKER_ENTRY_FILE}`,
    compatibility_date: COMPATIBILITY_DATE,
    compatibility_flags: ["nodejs_compat"],
    migrations: [
      {
        tag: "v1",
        new_sqlite_classes: ["AgentDurableObject"],
      },
    ],
    durable_objects: {
      bindings: [
        {
          name: "KALP_RUNTIME_CLOUDFLARE",
          class_name: "AgentDurableObject",
        },
      ],
    },
    kv_namespaces: [
      {
        binding: "KALP_MANIFESTS",
      },
    ],
    assets: {
      directory: `./${STUDIO_DIR}`,
      binding: "ASSETS",
      run_worker_first: true,
    },
    observability: { enabled: true },
    upload_source_maps: true,
    vars: {
      KALP_ENV: mode,
    },
    secrets: {
      required: requiredSecrets,
    },
  };
}

function runtimeTemplateCandidates(): Array<{
  studioTemplateDir: string;
  workerEntryPath: string;
}> {
  const here = dirname(fileURLToPath(import.meta.url));
  const distTemplateRoot = resolve(here, "runtime-template");
  const packageRootTemplate = resolve(here, "..", "runtime-template");
  const sourceTemplateRoot = resolve(here, "..", "..", "runtime-template");
  const monorepoStudioDist = resolve(
    here,
    "..",
    "..",
    "..",
    "..",
    "apps",
    "studio",
    "dist",
    "client",
  );

  return [
    {
      studioTemplateDir: join(distTemplateRoot, STUDIO_DIR),
      workerEntryPath: join(distTemplateRoot, WORKER_ENTRY_FILE),
    },
    {
      studioTemplateDir: join(packageRootTemplate, STUDIO_DIR),
      workerEntryPath: join(packageRootTemplate, WORKER_ENTRY_FILE),
    },
    {
      studioTemplateDir: join(sourceTemplateRoot, STUDIO_DIR),
      workerEntryPath: join(sourceTemplateRoot, WORKER_ENTRY_FILE),
    },
    {
      studioTemplateDir: monorepoStudioDist,
      workerEntryPath: join(sourceTemplateRoot, WORKER_ENTRY_FILE),
    },
  ];
}

async function resolveRuntimeTemplate(): Promise<RuntimeTemplatePaths> {
  for (const candidate of runtimeTemplateCandidates()) {
    try {
      await access(candidate.studioTemplateDir);
      await access(candidate.workerEntryPath);
      return candidate;
    } catch {
      // continue
    }
  }

  throw new Error(
    "Kalp runtime template not found in CLI package. Reinstall @kalphq/cli.",
  );
}

function createStudioShell(entryScript: string, cssFiles: string[]): string {
  const cssLinks = cssFiles
    .map((file) => `    <link rel="stylesheet" href="/studio/assets/${file}" />`)
    .join("\n");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Kalp Studio</title>
${cssLinks}
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/studio/assets/${entryScript}"></script>
  </body>
</html>
`;
}

async function ensureStudioIndex(studioDir: string): Promise<void> {
  const indexPath = join(studioDir, "index.html");
  try {
    await access(indexPath);
    return;
  } catch {
    // index.html is missing on some TanStack Start static builds.
  }

  const assetsDir = join(studioDir, "assets");
  const assetFiles = await readdir(assetsDir);
  const entryScript =
    assetFiles.find((file) => /^index-.*\.js$/i.test(file)) ??
    assetFiles.find((file) => file.endsWith(".js"));

  if (!entryScript) {
    throw new Error(
      "Studio runtime template is missing an entry JS bundle in studio/assets.",
    );
  }

  const cssFiles = assetFiles.filter((file) => file.endsWith(".css")).sort();
  const html = createStudioShell(entryScript, cssFiles);
  await writeFile(indexPath, html, "utf-8");
}

export async function readLocalAgentNames(cwd: string): Promise<string[]> {
  const agentsDir = join(cwd, "agents");
  try {
    const entries = await readdir(agentsDir, { withFileTypes: true });
    const names: string[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const indexPath = join(agentsDir, entry.name, "index.ts");
      const exists = await stat(indexPath)
        .then(() => true)
        .catch(() => false);
      if (exists) names.push(entry.name);
    }
    return names.sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

async function createAgentsSnapshot(
  cwd: string,
  mode: "local" | "remote",
): Promise<RuntimeAgentsSnapshot> {
  const localAgentNames = await readLocalAgentNames(cwd);
  const state = await readProjectState(cwd);

  const byName = new Map<string, RuntimeAgentRecord>();
  const stateAgents = state?.agents ?? {};

  for (const name of localAgentNames) {
    const localPath = join(cwd, "agents", name, "index.ts");
    const saved = stateAgents[name];
    const hasRemoteVersion = !!saved?.lastRemoteHash && (saved?.currentVersion ?? 0) > 0;

    if (mode === "remote" && !hasRemoteVersion) {
      continue;
    }

    const resolvedWorkerUrl =
      saved?.workerUrl ??
      (state?.workerUrl ? `${state.workerUrl.replace(/\/$/, "")}/a/${name}` : null);
    const versionNumber =
      typeof saved?.currentVersion === "number" && saved.currentVersion > 0
        ? saved.currentVersion
        : null;

    byName.set(name, {
      name,
      label: deriveLabelFromName(name),
      tags: [],
      environment:
        mode === "remote"
          ? "remote"
          : hasRemoteVersion
            ? "both"
            : "local",
      status: resolvedWorkerUrl ? "online" : "offline",
      hash: saved?.currentHash ?? null,
      version: versionNumber ? `v${versionNumber}` : null,
      versionNumber,
      lastRemoteHash: saved?.lastRemoteHash ?? null,
      lastLocalHash: saved?.lastLocalHash ?? null,
      workerUrl: resolvedWorkerUrl,
      localPath,
      updatedAt: saved?.lastPushedAt ?? state?.deployedAt ?? null,
    });
  }

  if (mode === "remote") {
    for (const [name, saved] of Object.entries(stateAgents)) {
      const hasRemoteVersion =
        !!saved.lastRemoteHash && (saved.currentVersion ?? 0) > 0;
      if (!hasRemoteVersion || byName.has(name)) continue;

      const localPath = saved.localPath ?? join(cwd, "agents", name, "index.ts");
      const workerUrl =
        saved.workerUrl ??
        (state?.workerUrl ? `${state.workerUrl.replace(/\/$/, "")}/a/${name}` : null);
      const versionNumber = saved.currentVersion > 0 ? saved.currentVersion : null;

      byName.set(name, {
        name,
        label: deriveLabelFromName(name),
        tags: [],
        environment: "remote",
        status: workerUrl ? "online" : "offline",
        hash: saved.currentHash ?? null,
        version: versionNumber ? `v${versionNumber}` : null,
        versionNumber,
        lastRemoteHash: saved.lastRemoteHash ?? null,
        lastLocalHash: saved.lastLocalHash ?? null,
        workerUrl,
        localPath,
        updatedAt: saved.lastPushedAt ?? state?.deployedAt ?? null,
      });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    projectPath: cwd,
    workerUrl: state?.workerUrl ?? null,
    mode,
    agents: Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export async function writeRuntimeAgentsSnapshot(params: {
  cwd: string;
  runtimeDir: string;
  mode: "local" | "remote";
}): Promise<void> {
  const snapshot = await createAgentsSnapshot(params.cwd, params.mode);
  await writeFile(
    join(params.runtimeDir, "agents.snapshot.json"),
    `${JSON.stringify(snapshot, null, 2)}\n`,
    "utf-8",
  );
}

export async function materializeRuntime(
  cwd: string,
  options: MaterializeRuntimeOptions = {},
): Promise<RuntimePaths> {
  const mode = options.mode ?? "remote";
  const runtimeDir = join(cwd, RUNTIME_ROOT, RUNTIME_DIR);
  const studioDir = join(runtimeDir, STUDIO_DIR);
  const workerEntrypointPath = join(runtimeDir, WORKER_ENTRY_FILE);
  const wranglerConfigPath = join(runtimeDir, WRANGLER_CONFIG_FILE);

  const template = await resolveRuntimeTemplate();
  await rm(runtimeDir, { recursive: true, force: true });
  await mkdir(runtimeDir, { recursive: true });

  await cp(template.studioTemplateDir, studioDir, { recursive: true });
  await cp(template.workerEntryPath, workerEntrypointPath);
  await ensureStudioIndex(studioDir);
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

  try {
    const provider = await resolveProviderFromConfig(cwd);
    requiredSecrets.add(getRequiredSecretForProvider(provider));
  } catch {
    // Ignore provider resolution errors here; deploy preflight handles strict checks.
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
  await writeFile(
    wranglerConfigPath,
    `${JSON.stringify(wranglerConfig, null, 2)}\n`,
    "utf-8",
  );

  return {
    runtimeDir,
    studioDir,
    workerEntrypointPath,
    wranglerConfigPath,
    workerName,
  };
}
