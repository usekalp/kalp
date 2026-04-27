import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { basename, join, resolve } from "node:path";
import { build } from "esbuild";

export interface HandlerEntry {
  name: string;
  code: string;
  hash: string;
  size: number;
}

export type HandlerMap = Record<string, HandlerEntry>;

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

const asRecord = (v: unknown): Record<string, unknown> | undefined =>
  v != null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : undefined;

const asString = (v: unknown): string | undefined =>
  typeof v === "string" ? v : undefined;

const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

interface WrapperSpec {
  name: string;
  code: string;
}

function buildWrappers(agentPath: string, agentConfig: unknown): WrapperSpec[] {
  const raw = asRecord(agentConfig);
  if (!raw) return [];

  const wrappers: WrapperSpec[] = [];
  const escapedPath = agentPath.replace(/\\/g, "/");

  if (raw.onMessage != null) {
    wrappers.push({
      name: "onMessage",
      code: `import agent from "${escapedPath}";\nexport default agent.onMessage;\n`,
    });
  }

  if (raw.onInit != null) {
    wrappers.push({
      name: "onInit",
      code: `import agent from "${escapedPath}";\nexport default agent.onInit;\n`,
    });
  }

  if (raw.onTick != null) {
    wrappers.push({
      name: "onTick",
      code: `import agent from "${escapedPath}";\nexport default agent.onTick;\n`,
    });
  }

  for (const step of asArray(raw.steps)) {
    const rec = asRecord(step);
    const id = rec ? asString(rec.id) : undefined;
    if (!id) continue;
    const safeName = `steps.${id}`;
    wrappers.push({
      name: safeName,
      code: `import agent from "${escapedPath}";\nconst _s = Array.isArray(agent.steps) ? agent.steps.find((s) => s.id === "${id}") : null;\nexport default _s?.run ?? null;\n`,
    });
  }

  for (const tool of asArray(raw.tools)) {
    const rec = asRecord(tool);
    const id = rec ? asString(rec.id) : undefined;
    if (!id) continue;
    const safeName = `tools.${id}`;
    wrappers.push({
      name: safeName,
      code: `import agent from "${escapedPath}";\nconst _t = Array.isArray(agent.tools) ? agent.tools.find((t) => t.id === "${id}") : null;\nexport default _t?.execute ?? null;\n`,
    });
  }

  for (const route of asArray(raw.routes)) {
    const rec = asRecord(route);
    const id = rec ? asString(rec.id) : undefined;
    if (!id) continue;
    const safeName = `routes.${id}`;
    wrappers.push({
      name: safeName,
      code: `import agent from "${escapedPath}";\nconst _r = Array.isArray(agent.routes) ? agent.routes.find((r) => r.id === "${id}") : null;\nexport default _r?.handler ?? null;\n`,
    });
  }

  return wrappers;
}

function makePlugins(cwd: string) {
  return [
    {
      name: "relative-js-to-ts",
      setup(buildCtx: any) {
        buildCtx.onResolve({ filter: /^\.\/.*\.js$/ }, (args: any) => {
          const resolved = resolve(args.resolveDir, args.path);
          if (existsSync(resolved)) return { path: resolved };
          const tsPath = resolved.replace(/\.js$/, ".ts");
          if (existsSync(tsPath)) return { path: tsPath };
          const tsxPath = resolved.replace(/\.js$/, ".tsx");
          if (existsSync(tsxPath)) return { path: tsxPath };
          return null;
        });
      },
    },
    {
      name: "tsconfig-paths",
      setup(buildCtx: any) {
        buildCtx.onResolve({ filter: /^@\// }, (args: any) => {
          const withoutPrefix = args.path.replace(/^@\//, "");
          const resolved = resolve(cwd, withoutPrefix);
          if (existsSync(resolved)) return { path: resolved };
          const tsPath = resolved + ".ts";
          if (existsSync(tsPath)) return { path: tsPath };
          const tsxPath = resolved + ".tsx";
          if (existsSync(tsxPath)) return { path: tsxPath };
          const indexTsPath = join(resolved, "index.ts");
          if (existsSync(indexTsPath)) return { path: indexTsPath };
          return null;
        });
      },
    },
  ];
}

export async function extractHandlers(
  agentPath: string,
  agentConfig: unknown,
  cwd: string,
): Promise<HandlerMap> {
  const wrappers = buildWrappers(agentPath, agentConfig);
  if (wrappers.length === 0) return {};

  const tempDir = await mkdtemp(join(cwd, ".kalp-handlers-"));

  try {
    const entryPoints: Record<string, string> = {};

    for (const wrapper of wrappers) {
      const safeFileName = wrapper.name.replace(/\./g, "_") + ".ts";
      const wrapperPath = join(tempDir, safeFileName);
      await writeFile(wrapperPath, wrapper.code, "utf-8");
      entryPoints[wrapper.name] = wrapperPath;
    }

    const result = await build({
      entryPoints,
      bundle: true,
      outdir: tempDir,
      format: "esm",
      platform: "browser",
      target: "es2020",
      logLevel: "silent",
      packages: "external",
      splitting: false,
      write: false,
      plugins: makePlugins(cwd),
    });

    const handlerMap: HandlerMap = {};

    for (const outputFile of result.outputFiles) {
      const fileName = basename(outputFile.path, ".js");
      const wrapper = wrappers.find((w) => w.name === fileName);
      if (!wrapper) continue;

      const code = outputFile.text;
      handlerMap[wrapper.name] = {
        name: wrapper.name,
        code,
        hash: sha256(code),
        size: outputFile.contents.byteLength,
      };
    }

    return handlerMap;
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
