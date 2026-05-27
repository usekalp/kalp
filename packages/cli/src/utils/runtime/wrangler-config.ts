import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";

export const WRANGLER_CONFIG_FILE = "wrangler.jsonc";
export const WORKER_ENTRY_FILE = "worker.js";
export const COMPATIBILITY_DATE = "2026-05-10";

export interface WranglerMigration {
  tag: string;
  new_sqlite_classes?: string[];
  renamed_classes?: Array<{ from: string; to: string }>;
  deleted_classes?: string[];
}

export interface WranglerConfig {
  $schema: string;
  name: string;
  main: string;
  compatibility_date: string;
  compatibility_flags: string[];
  migrations: WranglerMigration[];
  durable_objects: {
    bindings: Array<{ name: string; class_name: string }>;
  };
  kv_namespaces: Array<{ binding: string; id?: string }>;
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

function sanitizeSegment(input: string): string {
  return input
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/\//g, "-")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function resolveProjectSlug(cwd: string): Promise<string> {
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

export function buildWorkerName(slug: string, cwd: string): string {
  const cwdHash = createHash("sha1").update(cwd).digest("hex").slice(0, 8);
  const withPrefix = `kalp-${slug}-${cwdHash}`;
  const maxLen = 63;
  if (withPrefix.length <= maxLen) {
    return withPrefix;
  }

  const clipped = withPrefix.slice(0, maxLen).replace(/-+$/g, "");
  return clipped || `kalp-${cwdHash}`;
}

export function createRuntimeConfig(
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
        new_sqlite_classes: ["KalpAgent"],
      },
      {
        tag: "v2",
        renamed_classes: [{ from: "AgentDurableObject", to: "KalpAgent" }],
      },
    ],
    durable_objects: {
      bindings: [
        {
          name: "KALP_RUNTIME_CLOUDFLARE",
          class_name: "KalpAgent",
        },
      ],
    },
    kv_namespaces: [
      {
        binding: "KALP_MANIFESTS",
      },
    ],
    assets: {
      directory: "./studio",
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

export async function readExistingKvNamespaceIds(
  wranglerConfigPath: string,
): Promise<Record<string, string>> {
  try {
    const raw = await readFile(wranglerConfigPath, "utf-8");
    const config = JSON.parse(raw) as {
      kv_namespaces?: Array<{ binding: string; id?: string }>;
    };
    const ids: Record<string, string> = {};
    for (const kv of config.kv_namespaces ?? []) {
      if (kv.binding && kv.id) ids[kv.binding] = kv.id;
    }
    return ids;
  } catch {
    return {};
  }
}
