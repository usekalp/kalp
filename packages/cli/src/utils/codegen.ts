import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { access } from "node:fs/promises";

const GENERATED_HEADER = `// 🦋 Kalp Generated Types
// This file is auto-generated. Do not edit manually.
`;

/**
 * Parse secrets from kalp.config.ts content using regex
 * Looks for: secrets: ["KEY1", "KEY2"] or secrets: []
 */
function parseSecretsFromConfig(configContent: string): string[] | null {
  // Match secrets: [...] array
  const secretsMatch = configContent.match(/secrets:\s*\[([^\]]*)\]/);
  if (!secretsMatch) return null;

  const secretsArray = secretsMatch[1] ?? "";
  if (!secretsArray.trim()) return [];

  // Extract quoted strings from the array
  const secretMatches = secretsArray.match(/"([^"]+)"/g);
  if (!secretMatches) return [];

  return secretMatches.map((match) => match.replace(/"/g, ""));
}

/**
 * Generate types file based on secrets from kalp.config.ts
 */
export async function generateTypes(cwd: string): Promise<void> {
  const configPath = join(cwd, "kalp.config.ts");
  const kalpDir = join(cwd, ".kalp");
  const typesPath = join(kalpDir, "types.d.ts");

  let secrets: string[] = [];

  try {
    const configContent = await readFile(configPath, "utf-8");
    const parsed = parseSecretsFromConfig(configContent);
    if (parsed !== null) {
      secrets = parsed;
    }
  } catch {
    // Config doesn't exist yet, use empty array
    secrets = [];
  }

  // Ensure .kalp directory exists
  try {
    await mkdir(kalpDir, { recursive: true });
  } catch {
    // Directory might already exist
  }

  // Generate the types content
  const secretsTuple =
    secrets.length > 0 ? `[${secrets.map((s) => `"${s}"`).join(", ")}]` : "[]";

  const typesContent = `${GENERATED_HEADER}/**
 * Registered secrets from kalp.config.ts
 * @generated
 */
export type RegisteredSecretKeys = ${secretsTuple};
`;

  await writeFile(typesPath, typesContent, "utf-8");
}

/**
 * Update kalp.d.ts to import and use generated types
 */
export async function updateKalpDts(cwd: string): Promise<void> {
  const kalpDtsPath = join(cwd, "kalp.d.ts");

  // Check if kalp.d.ts exists
  try {
    await access(kalpDtsPath);
  } catch {
    // Create new kalp.d.ts if it doesn't exist
    const content = `import "@kalphq/sdk";

import type { RegisteredSecretKeys } from "./.kalp/types";

declare module "@kalphq/sdk" {
  interface SecretsRegistry {
    keys: RegisteredSecretKeys;
  }
}
`;
    await writeFile(kalpDtsPath, content, "utf-8");
    return;
  }

  // Read existing content
  const existingContent = await readFile(kalpDtsPath, "utf-8");

  // Check if it already imports from .kalp/types
  if (existingContent.includes("./.kalp/types")) {
    // Already using generated types, no need to update
    return;
  }

  // Update to use generated types
  const updatedContent = `import "@kalphq/sdk";
import type { RegisteredSecretKeys } from "./.kalp/types";

declare module "@kalphq/sdk" {
  interface SecretsRegistry {
    keys: RegisteredSecretKeys;
  }
}
`;

  await writeFile(kalpDtsPath, updatedContent, "utf-8");
}

/**
 * Ensure tsconfig.json includes .kalp/types.d.ts
 */
export async function updateTsconfig(cwd: string): Promise<void> {
  const tsconfigPath = join(cwd, "tsconfig.json");

  try {
    const content = await readFile(tsconfigPath, "utf-8");
    const config = JSON.parse(content);

    if (!config.include) {
      config.include = [];
    }

    const typesPath = ".kalp/types.d.ts";
    if (!config.include.includes(typesPath)) {
      config.include.unshift(typesPath);
      await writeFile(tsconfigPath, JSON.stringify(config, null, 2), "utf-8");
    }
  } catch {}
}
