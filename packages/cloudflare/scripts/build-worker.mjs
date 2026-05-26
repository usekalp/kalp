import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const src = path.resolve(root, "src");
const out = path.resolve(root, "dist");

const alias = Object.fromEntries(
  [
    "agent",
    "effects",
    "kv-storage",
    "persistence",
    "shared",
    "studio",
    "wiring",
  ].map((p) => [`@/${p}`, path.resolve(src, p)]),
);

await build({
  entryPoints: [path.resolve(src, "worker.ts")],
  bundle: true,
  outfile: path.join(out, "worker.js"),
  format: "esm",
  platform: "node",
  target: "esnext",
  external: ["cloudflare:workers", "cloudflare:email"],
  alias,
  allowOverwrite: true,
  plugins: [
    {
      name: "fix-module-loader",
      setup(build_) {
        build_.onLoad({ filter: /chunk-/ }, async (args) => {
          const contents = await readFile(args.path, "utf8");
          if (!contents.includes("import(dataUrl)")) return;
          const patched = contents.replace(
            /const\s+dataUrl\s*=\s*`data:text\/javascript;charset=utf-8,\$\{encodeURIComponent\(code\)\}`;[\s\S]*?const\s+mod\s*=\s*await\s+import\(dataUrl\);/,
            "const mod = { default: async () => { throw new Error('[kalp] Dynamic bundle loading not available in local dev. Use `kalp deploy` to test.'); } };",
          );
          return { contents: patched, loader: "js" };
        });
      },
    },
  ],
});
