#!/usr/bin/env node

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * sync-versions.mjs
 * Fetches the latest stable version from NPM for each public package
 * and updates the local package.json to remove dev/snapshot versions.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const pkgs = [];
for (const dir of ["packages", "apps"]) {
  const baseDir = join(ROOT, dir);
  if (!existsSync(baseDir)) continue;
  for (const name of readdirSync(baseDir)) {
    const pkgPath = join(baseDir, name, "package.json");
    if (existsSync(pkgPath)) pkgs.push({ path: pkgPath });
  }
}

console.log("🔍 Syncing local versions with NPM stable...");

for (const pkgInfo of pkgs) {
  try {
    const content = readFileSync(pkgInfo.path, "utf-8");
    const json = JSON.parse(content);
    
    if (json.private || !json.name) continue;

    process.stdout.write(`📦 Checking ${json.name}... `);
    
    try {
      // Get latest stable version from NPM
      const latest = execSync(`npm view ${json.name} version`, { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim();
      
      if (json.version !== latest) {
        console.log(`Updating: ${json.version} -> ${latest}`);
        json.version = latest;
        writeFileSync(pkgInfo.path, JSON.stringify(json, null, 2) + "\n");
      } else {
        console.log(`Already at latest: ${latest}`);
      }
    } catch {
      console.log("Not found on NPM, skipping.");
    }
  } catch (e) {
    console.warn(`\n❌ Failed to process ${pkgInfo.path}`);
  }
}

console.log("\n✅ Done. Local versions are now synced with NPM stable.");
