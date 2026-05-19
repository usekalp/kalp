import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
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
        "src/engine/types.ts",
        "src/env.d.ts",
      ],
      thresholds: {
        lines: 95,
        functions: 90,
        branches: 85,
      },
    },
  },
});
