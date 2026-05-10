import { createHash } from "node:crypto";
import {
  access,
  cp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { createRequire } from "node:module";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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

function createRuntimeConfig(workerName: string): WranglerConfig {
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
    secrets: {
      required: ["KALP_SECRET_KEY"],
    },
  };
}

function assertCloudflareRuntimeDependency(cwd: string): void {
  try {
    const requireFromProject = createRequire(join(cwd, "package.json"));
    requireFromProject.resolve("@kalphq/cloudflare");
  } catch {
    throw new Error(
      "Missing dependency @kalphq/cloudflare in this project. Install it and retry `kalp dev`/`kalp deploy`.",
    );
  }
}

function runtimeTemplateCandidates(): Array<{
  studioTemplateDir: string;
  workerEntryPath: string;
}> {
  const here = dirname(fileURLToPath(import.meta.url));
  const distTemplateRoot = resolve(here, "..", "runtime-template");
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

export async function materializeRuntime(cwd: string): Promise<RuntimePaths> {
  assertCloudflareRuntimeDependency(cwd);

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

  const projectSlug = await resolveProjectSlug(cwd);
  const workerName = buildWorkerName(projectSlug, cwd);
  const wranglerConfig = createRuntimeConfig(workerName);
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
