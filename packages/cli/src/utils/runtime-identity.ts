import { build } from "esbuild";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  loadProjectConfig,
  resolveRuntimeIdentityConfig,
  type RuntimeIdentityConfig,
} from "@/utils/project-config";

const NODE_BUILTIN_IMPORTS = new Set([
  "fs",
  "path",
  "crypto",
  "os",
  "child_process",
  "worker_threads",
  "net",
  "tls",
  "http",
  "https",
  "zlib",
  "stream",
  "url",
  "process",
  "buffer",
]);

export interface MaterializeRuntimeIdentityResult {
  identityConfig: RuntimeIdentityConfig;
  identityConfigPath: string;
  identityMapPath: string;
}

const DEFAULT_IDENTITY_MAP_SOURCE = `export default function mapIdentity(payload) {
  const sub =
    payload && typeof payload === "object" && typeof payload.sub === "string"
      ? payload.sub
      : "anonymous";
  return { userId: sub, claims: {} };
}
`;

function readIdentityMapCandidate(rawConfig: Record<string, unknown>): unknown {
  if (!rawConfig.identity || typeof rawConfig.identity !== "object") return null;
  return (rawConfig.identity as Record<string, unknown>).mapIdentity;
}

async function writeDefaultIdentityMap(identityMapPath: string): Promise<void> {
  await writeFile(identityMapPath, DEFAULT_IDENTITY_MAP_SOURCE, "utf-8");
}

async function bundleIdentityMap(params: {
  cwd: string;
  configPath: string;
  identityMapPath: string;
}): Promise<void> {
  const { cwd, configPath, identityMapPath } = params;
  const configSpecifier = pathToFileURL(configPath).href;
  const entrySource = `
import configModule from ${JSON.stringify(configSpecifier)};
const config = (configModule && typeof configModule === "object" && "default" in configModule)
  ? (configModule.default ?? configModule)
  : configModule;

const mapper = config?.identity?.mapIdentity;
if (typeof mapper !== "function") {
  throw new Error("identity.mapIdentity must be a function.");
}

export default mapper;
`;

  try {
    await build({
      absWorkingDir: cwd,
      bundle: true,
      format: "esm",
      platform: "browser",
      target: ["es2022"],
      write: true,
      outfile: identityMapPath,
      logLevel: "silent",
      plugins: [
        {
          name: "kalp-edge-identity-guard",
          setup(buildContext) {
            buildContext.onResolve({ filter: /.*/ }, (args) => {
              const raw = args.path.startsWith("node:")
                ? args.path.slice(5)
                : args.path;
              if (NODE_BUILTIN_IMPORTS.has(raw)) {
                return {
                  errors: [
                    {
                      text: `Node builtin "${args.path}" is not supported in identity.mapIdentity for edge runtime.`,
                    },
                  ],
                };
              }
              return null;
            });
          },
        },
      ],
      stdin: {
        contents: entrySource,
        resolveDir: cwd,
        sourcefile: "kalp-identity-map-entry.mjs",
        loader: "js",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Could not bundle identity.mapIdentity for runtime. Ensure mapIdentity is edge-safe (no Node built-ins). ${message}`,
    );
  }
}

export async function materializeRuntimeIdentity(params: {
  cwd: string;
  runtimeDir: string;
}): Promise<MaterializeRuntimeIdentityResult> {
  const { cwd, runtimeDir } = params;
  const identityConfigPath = join(runtimeDir, "identity.config.json");
  const identityMapPath = join(runtimeDir, "identity.map.mjs");

  let rawConfig: Record<string, unknown> = {};
  let configPath: string | null = null;
  try {
    const loaded = await loadProjectConfig(cwd);
    rawConfig = loaded.raw;
    configPath = loaded.path;
  } catch {
    rawConfig = {};
    configPath = null;
  }

  const identityConfig = resolveRuntimeIdentityConfig(rawConfig);
  await writeFile(identityConfigPath, `${JSON.stringify(identityConfig, null, 2)}\n`, "utf-8");

  const mapIdentity = readIdentityMapCandidate(rawConfig);
  if (typeof mapIdentity === "function" && configPath) {
    await bundleIdentityMap({
      cwd,
      configPath,
      identityMapPath,
    });
  } else {
    await writeDefaultIdentityMap(identityMapPath);
  }

  return { identityConfig, identityConfigPath, identityMapPath };
}
