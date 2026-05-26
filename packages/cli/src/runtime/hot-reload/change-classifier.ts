import type { RestartReason } from "../types";
import type { RuntimePaths } from "@/utils/runtime";
import { join } from "node:path";

export interface ClassifiedChange {
  domain: "agent" | "env" | "runtime-template" | "unknown";
  restartReason: RestartReason | null;
  requiresRematerialize: boolean;
}

export function classifyChange(
  changedPath: string,
  runtimePaths: RuntimePaths,
  cwd: string,
): ClassifiedChange {
  const normalized = changedPath.replace(/\\/g, "/");
  const normalizedCwd = cwd.replace(/\\/g, "/");

  if (normalized.endsWith(".env") || normalized.endsWith(".dev.vars")) {
    return { domain: "env", restartReason: "env-change", requiresRematerialize: false };
  }

  const runtimeTemplateDir = join(runtimePaths.runtimeDir, "..", "..", "..", "packages", "cloudflare", "src").replace(/\\/g, "/");
  if (normalized.startsWith(runtimeTemplateDir) || normalized.includes("/cloudflare/src/")) {
    return { domain: "runtime-template", restartReason: "runtime-template-change", requiresRematerialize: true };
  }

  const agentsDir = join(cwd, "agents").replace(/\\/g, "/");
  if (normalized.startsWith(agentsDir)) {
    return { domain: "agent", restartReason: "code-change", requiresRematerialize: false };
  }

  return { domain: "unknown", restartReason: null, requiresRematerialize: false };
}
