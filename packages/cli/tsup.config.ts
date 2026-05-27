import { defineConfig } from "tsup";
import { cp, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  clean: true,
  sourcemap: true,
  banner: { js: "#!/usr/bin/env node" },
  external: ["esbuild"],
  noExternal: ["@kalphq/sdk", "jose"],
  async onSuccess() {
    const dist = resolve(import.meta.dirname, "dist");
    const template = join(dist, "runtime-template");
    await mkdir(join(template, "studio", "assets"), { recursive: true });

    const cloudflareDist = resolve(
      import.meta.dirname,
      "..",
      "cloudflare",
      "dist",
    );
    await cp(join(cloudflareDist, "worker.js"), join(template, "worker.js")).catch(() => {
      console.warn("[kalp build] cloudflare worker.js not found — skipping");
    });
  },
});
