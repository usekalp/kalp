import { defineConfig } from "tsup";
import path from "node:path";

const alias = Object.fromEntries(
  [
    "agent",
    "effects",
    "kv-storage",
    "persistence",
    "shared",
    "studio",
    "studio/auth",
    "studio/resolvers",
  ].map((p) => [`@/${p}`, path.resolve(__dirname, `src/${p}`)]),
);

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: false,
  external: [
    "cloudflare:workers",
    "@kalphq/core",
    "@kalphq/sdk",
  ],
  esbuildOptions(options) {
    options.alias = { ...options.alias, ...alias };
  },
});
