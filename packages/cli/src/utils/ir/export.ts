import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * TODO remove after SaaS observability: debug IR export for local inspection.
 */
export async function exportCompiledIrForDebug(params: {
  cwd: string;
  agentName: string;
  ir: unknown;
}): Promise<string> {
  const { cwd, agentName, ir } = params;
  const outDir = join(cwd, ".kalp", "exports", agentName);
  await mkdir(outDir, { recursive: true });
  const outputPath = join(outDir, "ir.json");
  await writeFile(outputPath, `${JSON.stringify(ir, null, 2)}\n`, "utf-8");
  return outputPath;
}
