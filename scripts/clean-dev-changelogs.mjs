#!/usr/bin/env node

/**
 * clean-dev-changelogs.mjs — Removes all dev releases from CHANGELOG.md files.
 * Keeps only non-dev (production) releases.
 */

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Checks if a version string is a dev release.
 * @param {string} version
 * @returns {boolean}
 */
function isDevVersion(version) {
  return version.includes("-dev-");
}

/**
 * Cleans a changelog by removing dev release entries.
 * @param {string} content
 * @returns {string | null}
 */
function cleanChangelog(content) {
  const lines = content.split("\n");
  const result = [];
  let currentEntry = [];
  let currentVersion = null;
  let inDevEntry = false;

  for (const line of lines) {
    const versionMatch = line.match(/^##\s+(.+)$/);

    if (versionMatch) {
      // Flush previous entry
      if (currentVersion && !inDevEntry) {
        result.push(...currentEntry);
      }

      // Start new entry
      currentVersion = versionMatch[1].trim();
      inDevEntry = isDevVersion(currentVersion);
      currentEntry = [line];
    } else if (currentVersion) {
      currentEntry.push(line);
    } else {
      // Before first version (title/header)
      result.push(line);
    }
  }

  // Flush final entry
  if (currentVersion && !inDevEntry) {
    result.push(...currentEntry);
  }

  // If nothing left, return null
  const cleaned = result.join("\n").trim();
  if (!cleaned || cleaned === content.split("\n")[0].trim()) {
    return null; // Only header, no releases
  }

  return cleaned;
}

/**
 * Processes all changelogs in a directory.
 * @param {string} dir
 */
function processDirectory(dir) {
  let entries;
  try {
    entries = readdirSync(join(ROOT, dir), { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const changelogPath = join(ROOT, dir, entry.name, "CHANGELOG.md");
    try {
      const content = readFileSync(changelogPath, "utf-8");
      const cleaned = cleanChangelog(content);

      if (cleaned === null) {
        console.log(`⚠️  ${dir}/${entry.name}/CHANGELOG.md — no non-dev releases left, skipping`);
      } else if (cleaned !== content.trim()) {
        writeFileSync(changelogPath, cleaned + "\n");
        console.log(`✅ Cleaned ${dir}/${entry.name}/CHANGELOG.md`);
      } else {
        console.log(`⏭️  ${dir}/${entry.name}/CHANGELOG.md — no dev releases found`);
      }
    } catch {
      // No changelog, skip
    }
  }
}

// ── Main ────────────────────────────────────────────────────────────────────
console.log("🧹 Cleaning dev releases from changelogs...\n");

for (const dir of ["packages", "apps"]) {
  processDirectory(dir);
}

console.log("\n✨ Done!");
