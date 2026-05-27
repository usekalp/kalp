import { defineConfig } from "vitest/config";
import { resolve } from "node:path";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    tsconfigPaths({
      projects: [
        resolve(__dirname, "tsconfig.json"),
        resolve(__dirname, "../sdk/tsconfig.json"),
      ],
    }),
  ],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      "@kalphq/sdk": resolve(__dirname, "../sdk/src/index.ts"),
      "@kalphq/project": resolve(__dirname, "../project/src/index.ts"),
      "@kalphq/compiler": resolve(__dirname, "../compiler/src/index.ts"),
      "@kalphq/core": resolve(__dirname, "../core/src/index.ts"),
      "@kalphq/cloudflare": resolve(__dirname, "../cloudflare/src/index.ts"),
    },
  },
  test: {
    include: ["test/**/*.test.ts"],
    watch: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.spec.ts",
        "src/**/index.ts",
        "src/index.ts",
        "src/runtime-template/**",
      ],
      thresholds: {
        lines: 60,
        functions: 50,
        branches: 40,
      },
    },
  },
});
