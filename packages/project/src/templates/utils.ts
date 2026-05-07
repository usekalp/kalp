/**
 * Shared utilities for template generation.
 *
 * @module
 */

import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

/**
 * Ensure directory exists and write file.
 */
export async function writeTemplateFile(
  dir: string,
  filename: string,
  content: string,
): Promise<void> {
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, filename), content.trim() + "\n", "utf-8");
}
