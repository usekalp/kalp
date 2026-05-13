import { ensureConfig } from "@/utils/fs";
import { readProjectState } from "@/utils/project-state";
import { materializeRuntime } from "@/utils/runtime";

export async function resolveSecretsRuntimeConfigPath(cwd: string): Promise<string> {
  await ensureConfig(cwd).catch(() => {
    throw new Error("kalp.config.ts not found.");
  });

  const state = await readProjectState(cwd);
  if (!state?.workerUrl) {
    throw new Error(
      "No remote runtime found for this project. Run `kalp deploy` first.",
    );
  }

  const runtime = await materializeRuntime(cwd, { mode: "remote" });
  return runtime.wranglerConfigPath;
}
