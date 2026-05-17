import { build } from "esbuild";
import fs from "node:fs";
import { createHash } from "crypto";
import path from "node:path";

const SDK_RUNTIME_SHIM = `
  export const everySixHours = "0 */6 * * *";
  export function defineAgent(config) { return config; }
  export function defineHook(config) { return config; }
  export function defineCron(config) { return config; }
  export function defineTool(config) {
    return { ...config, kind: "tool", __runtimeId: \`tool:\${config.id}\` };
  }
  export function defineToolFor() {
    return (config) => defineTool(config);
  }
  export function defineListener(config) {
    return { ...config, kind: "listener", __runtimeId: \`listener:\${config.event}\` };
  }
  export function defineListenerFor() {
    return (config) => defineListener(config);
  }
  export function defineContract(config) {
    return { ...config, kind: "contract", __runtimeId: \`contract:\${config.name}\` };
  }
  export function defineContractFor() {
    return (config) => defineContract(config);
  }
  export function defineRoute(config) {
    return {
      ...config,
      kind: "route",
      __runtimeId: \`route:\${config.method}:\${config.path}\`,
    };
  }
  export function defineRouteFor() {
    return (config) => defineRoute(config);
  }
  export function getRegistry() { return new Map(); }
  export function clearRegistry() {}
`;

function sanitizeFileStem(input: string): string {
  return input.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

export interface BundledHandler {
  hash: string;
  file: string;
  size: number;
  format: "esm";
  entry: "default";
  sha256: string;
  code: string;
}

/**
 * Bundles a single handler into an ESM artifact file.
 */
export async function bundleHandler(
  filePath: string,
  bundlesDir: string,
  exportName: string,
): Promise<BundledHandler> {
  const normalizedSourcePath = filePath.replace(/\\/g, "/");
  const safeName = sanitizeFileStem(exportName);
  const tempFile = path.join(bundlesDir, `${safeName}.js`);

  const contents = `
    import * as mod from ${JSON.stringify(normalizedSourcePath)};
    const exportName = ${JSON.stringify(exportName)};

    const resolvePath = (source, targetPath) => {
      if (!source || !targetPath) return undefined;
      const normalized = targetPath.replace(/\\[(\\d+)\\]/g, ".$1");
      return normalized
        .split(".")
        .filter(Boolean)
        .reduce((current, key) => (current == null ? undefined : current[key]), source);
    };

    let target = resolvePath(mod, exportName);
    if (target === undefined && mod.default && typeof mod.default === "object") {
      target = resolvePath(mod.default, exportName);
    }
    if (target === undefined) {
      target = mod.default;
    }

    const handler = target && typeof target === "object" && typeof target.handler === "function"
      ? target.handler
      : target;

    export default handler;
  `;

  await build({
    stdin: {
      contents,
      resolveDir: path.dirname(filePath),
      loader: "ts",
      sourcefile: `${safeName}.entry.ts`,
    },
    bundle: true,
    format: "esm",
    platform: "neutral",
    target: "es2022",
    minify: false,
    write: true,
    outfile: tempFile,
    external: ["zod"],
    plugins: [
      {
        name: "kalp-sdk-runtime-shim",
        setup(buildApi) {
          buildApi.onResolve({ filter: /^@kalphq\/sdk$/ }, () => ({
            path: "kalp-sdk-runtime-shim",
            namespace: "kalp-shim",
          }));

          buildApi.onLoad({ filter: /.*/, namespace: "kalp-shim" }, () => ({
            contents: SDK_RUNTIME_SHIM,
            loader: "ts",
          }));
        },
      },
    ],
    logOverride: {
      "import-is-undefined": "silent",
    },
  });

  const code = fs.readFileSync(tempFile, "utf-8").replace(/\r\n/g, "\n").trim();
  const sha256 = createHash("sha256").update(code).digest("hex");
  const hash = sha256.slice(0, 8);
  const finalFileName = `${hash}.js`;
  const finalFile = path.join(bundlesDir, finalFileName);
  fs.writeFileSync(finalFile, `${code}\n`, "utf-8");

  try {
    fs.unlinkSync(tempFile);
  } catch {}

  return {
    hash,
    file: `./targets/default/bundles/${finalFileName}`,
    size: Buffer.byteLength(code, "utf-8"),
    format: "esm",
    entry: "default",
    sha256,
    code,
  };
}

export function ensureArtifactsDirs(outDir: string) {
  const artifactsDir = path.join(outDir, ".kalp", "artifacts");
  const bundlesDir = path.join(artifactsDir, "targets", "default", "bundles");
  if (!fs.existsSync(bundlesDir)) {
    fs.mkdirSync(bundlesDir, { recursive: true });
  }
  return { artifactsDir, bundlesDir };
}
