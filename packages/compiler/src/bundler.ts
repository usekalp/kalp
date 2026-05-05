// packages/compiler/src/bundler.ts
import { build } from "esbuild";
import { readFileSync, writeFileSync } from "fs";
import { createHash } from "crypto";
import path from "path";

/**
 * Bundles a single handler by extracting it from its source file.
 * 
 * @param filePath - The absolute path to the source file.
 * @param outDir - The output directory for the IR.
 * @param exportName - The name of the export to bundle.
 */
export async function bundleHandler(
  filePath: string,
  outDir: string,
  exportName: string,
  _unused_isNode?: boolean 
): Promise<{ handlerFile: string; hash: string }> {
  const name = exportName;
  const outFile = path.join(outDir, "handlers", `${name}.js`);
  
  // Normalize path for esbuild stdin resolution
  const normalizedSourcePath = filePath.replace(/\\/g, "/");

  // Virtual entry point logic:
  // 1. Import the module.
  // 2. Resolve the target export (named or from default object).
  // 3. If the target has a .handler property (Step/Tool/Route), use it.
  // 4. Otherwise use the target directly (Hook).
  const contents = `
    import * as mod from "${normalizedSourcePath}";
    const exportName = "${exportName}";
    
    // Resolve target: check named exports first, then properties of the default export
    let target = mod[exportName];
    if (target === undefined && mod.default && typeof mod.default === 'object') {
      target = mod.default[exportName];
    }
    
    // Fallback to default export if exportName matches or if target still undefined
    if (target === undefined) {
      target = mod.default;
    }

    // Extract handler if it's a node/route object
    const handler = (target && typeof target === 'object' && typeof target.handler === 'function') 
      ? target.handler 
      : target;
      
    export default handler;
  `;

  await build({
    stdin: {
      contents,
      resolveDir: path.dirname(filePath),
      loader: "ts",
    },
    bundle: true,
    platform: "neutral",
    format: "iife",
    globalName: "__handler",
    footer: {
      js: " __handler", 
    },
    target: "es2020",
    minify: false,
    write: true,
    outfile: outFile,
    metafile: true,
  });

  const code = readFileSync(outFile, "utf-8");
  const normalized = code.replace(/\r\n/g, "\n").trim();
  const hash = createHash("sha256")
    .update(normalized)
    .digest("hex")
    .slice(0, 8);
    
  const hashedFile = path.join(
    outDir,
    "handlers",
    `${name}.${hash}.js`
  );
  writeFileSync(hashedFile, normalized, "utf-8");
  
  try {
    const fs = require("fs");
    fs.unlinkSync(outFile);
  } catch {}
  
  const relPath = "./" + path.relative(outDir, hashedFile).replace(/\\/g, "/");
  return { handlerFile: relPath, hash };
}

/**
 * Helper to ensure the handlers directory exists.
 */
export function ensureHandlersDir(outDir: string) {
  const dir = path.join(outDir, "handlers");
  const fs = require("fs");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
