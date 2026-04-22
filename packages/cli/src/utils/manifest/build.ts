import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import type { LoadedAgentModule } from "@/utils/manifest/types";

async function getHash(payload: string): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(payload).digest("hex");
}

export async function loadAgentModule(
  agentPath: string,
  cwd: string,
): Promise<LoadedAgentModule> {
  const tempDir = await mkdtemp(join(cwd, ".kalp-temp-"));
  const outFile = join(tempDir, "agent.manifest.mjs");

  await build({
    entryPoints: [agentPath],
    outfile: outFile,
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node18",
    logLevel: "silent",
    packages: "external",
    plugins: [
      {
        name: "relative-js-to-ts",
        setup(buildCtx) {
          buildCtx.onResolve({ filter: /^\.\/.*\.js$/ }, (args) => {
            const resolved = resolve(args.resolveDir, args.path);
            if (existsSync(resolved)) {
              return { path: resolved };
            }

            const tsPath = resolved.replace(/\.js$/, ".ts");
            if (existsSync(tsPath)) {
              return { path: tsPath };
            }

            const tsxPath = resolved.replace(/\.js$/, ".tsx");
            if (existsSync(tsxPath)) {
              return { path: tsxPath };
            }

            return null;
          });
        },
      },
      {
        name: "tsconfig-paths",
        setup(buildCtx) {
          buildCtx.onResolve({ filter: /^@\// }, (args) => {
            const withoutPrefix = args.path.replace(/^@\//, "");
            const resolved = resolve(cwd, withoutPrefix);

            if (existsSync(resolved)) {
              return { path: resolved };
            }

            const tsPath = resolved + ".ts";
            if (existsSync(tsPath)) {
              return { path: tsPath };
            }

            const tsxPath = resolved + ".tsx";
            if (existsSync(tsxPath)) {
              return { path: tsxPath };
            }

            const indexTsPath = join(resolved, "index.ts");
            if (existsSync(indexTsPath)) {
              return { path: indexTsPath };
            }

            return null;
          });
        },
      },
    ],
  });

  const loaded = (await import(
    `${pathToFileURL(outFile).href}?t=${Date.now()}`
  )) as { default?: unknown };

  const bundledCode = await readFile(outFile, "utf-8");
  const codeHash = await getHash(bundledCode);

  return {
    agent: loaded.default,
    entry: basename(outFile),
    tempDir,
    codeHash,
  };
}

export async function cleanupTempDir(tempDir: string): Promise<void> {
  await rm(tempDir, { recursive: true, force: true });
}
