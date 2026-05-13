import { build } from "esbuild";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  loadProjectConfig,
  resolveRuntimeIdentityConfig,
  type RuntimeIdentityConfig,
} from "@/utils/project-config";

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

function assertEdgeSafeSource(mapIdentitySource: string): void {
  const blockedPatterns: Array<{ regex: RegExp; label: string }> = [
    { regex: /\brequire\s*\(/, label: "require(...)" },
    { regex: /\bnode:/, label: "node:* imports" },
    { regex: /\bprocess\./, label: "process.*" },
    { regex: /\bBuffer\b/, label: "Buffer" },
    { regex: /\bimport\s*\(/, label: "dynamic import(...)" },
  ];

  const hit = blockedPatterns.find((item) => item.regex.test(mapIdentitySource));
  if (!hit) return;

  throw new Error(
    `mapIdentity uses "${hit.label}", which is not supported in edge runtime.`,
  );
}

async function writeDefaultIdentityMap(identityMapPath: string): Promise<void> {
  await writeFile(identityMapPath, DEFAULT_IDENTITY_MAP_SOURCE, "utf-8");
}

async function bundleIdentityMap(params: {
  cwd: string;
  mapIdentitySource: string;
  identityMapPath: string;
}): Promise<void> {
  const { cwd, mapIdentitySource, identityMapPath } = params;
  assertEdgeSafeSource(mapIdentitySource);

  const entrySource = `
const mapIdentity = (${mapIdentitySource});
if (typeof mapIdentity !== "function") {
  throw new Error("identity.mapIdentity must be a function.");
}
export default mapIdentity;
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
      [
        "Could not bundle identity.mapIdentity for runtime.",
        "Please verify:",
        "  • kalp.config.ts exists and exports default defineConfig(...)",
        "  • mapIdentity is declared inline and does not capture external variables",
        "  • mapIdentity does not use Node-specific APIs",
        "  • kalp.config.ts has no broken imports",
        `Technical details: ${message}`,
      ].join("\n"),
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
  try {
    const loaded = await loadProjectConfig(cwd);
    rawConfig = loaded.raw;
  } catch {
    rawConfig = {};
  }

  const identityConfig = resolveRuntimeIdentityConfig(rawConfig);
  await writeFile(
    identityConfigPath,
    `${JSON.stringify(identityConfig, null, 2)}\n`,
    "utf-8",
  );

  const mapIdentity = readIdentityMapCandidate(rawConfig);
  if (typeof mapIdentity === "function") {
    const mapIdentitySource = mapIdentity.toString();
    if (!mapIdentitySource || /\[native code\]/.test(mapIdentitySource)) {
      throw new Error(
        "Could not serialize identity.mapIdentity. Define it inline in kalp.config.ts as a regular function.",
      );
    }
    await bundleIdentityMap({
      cwd,
      mapIdentitySource,
      identityMapPath,
    });
  } else {
    await writeDefaultIdentityMap(identityMapPath);
  }

  return { identityConfig, identityConfigPath, identityMapPath };
}
