#!/usr/bin/env node

/**
 * dev-release.mjs — cross-platform dev release.
 * Publishes all public packages under the `dev` npm tag with a snapshot version.
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const run = (cmd) => (
  console.log(`> ${cmd}`),
  execSync(cmd, { cwd: ROOT, stdio: "inherit" })
);

// ── Find all public (publishable) packages ──────────────────────────────────
const pkgs = [];
for (const dir of ["packages", "apps"]) {
  let entries;
  try {
    entries = readdirSync(join(ROOT, dir));
  } catch {
    continue;
  }
  for (const name of entries) {
    try {
      const pkg = JSON.parse(
        readFileSync(join(ROOT, dir, name, "package.json"), "utf-8"),
      );
      if (!pkg.private && pkg.name)
        pkgs.push({ name: pkg.name, rel: `${dir}/${name}` });
    } catch {
      /* skip */
    }
  }
}

if (pkgs.length === 0) {
  console.log("No public packages found.");
  process.exit(0);
}
console.log(`Publishing: ${pkgs.map((p) => p.name).join(", ")}\n`);

// ── Temp changeset → snapshot version → build → publish → revert ────────────
const tempFile = join(ROOT, ".changeset", "dev-release-temp.md");
writeFileSync(
  tempFile,
  `---\n${pkgs.map((p) => `"${p.name}": patch`).join("\n")}\n---\n\ndev release\n`,
);

try {
  run("pnpm changeset version --snapshot dev");
  run("pnpm turbo build");
  run("pnpm changeset publish --tag dev --no-git-tag --snapshot");
} finally {
  try {
    run(
      `git checkout -- ${pkgs.map((p) => `${p.rel}/package.json`).join(" ")} .changeset/`,
    );
  } catch {
    console.warn(
      "Could not auto-revert. Run: git checkout -- .changeset/ packages/*/package.json",
    );
  }
}
