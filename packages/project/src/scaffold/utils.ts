import { writeFile, readFile, readdir, mkdir, access } from "node:fs/promises";
import { join } from "node:path";
import { format } from "prettier";

/**
 * Formats generated TypeScript files using Prettier.
 */
export async function formatGeneratedFile(
  filePath: string,
  content: string,
): Promise<string> {
  if (!filePath.endsWith(".ts") && !filePath.endsWith(".tsx")) {
    return content;
  }

  try {
    return await format(content, {
      parser: "typescript",
      semi: true,
      singleQuote: false,
      trailingComma: "all",
      printWidth: 80,
    });
  } catch {
    return content;
  }
}

/**
 * Recursively replaces placeholders in all files within a directory.
 */
export async function replacePlaceholders(
  dir: string,
  map: Record<string, string>,
): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fp = join(dir, entry.name);
    if (entry.isDirectory()) {
      await replacePlaceholders(fp, map);
    } else if (entry.isFile() && entry.name !== ".gitkeep") {
      const content = await readFile(fp, "utf-8");
      let newContent = content;
      for (const [key, value] of Object.entries(map)) {
        newContent = newContent.replaceAll(key, value);
      }
      if (newContent !== content) {
        await writeFile(fp, newContent, "utf-8");
      }
    }
  }
}

/**
 * Ensures a directory exists, creating it if necessary.
 */
export async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

/**
 * Writes a file only if it doesn't already exist.
 */
export async function writeFileIfNotExists(
  filePath: string,
  content: string,
): Promise<void> {
  try {
    await access(filePath);
  } catch {
    await writeFile(filePath, content, "utf-8");
  }
}
