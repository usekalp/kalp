import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { readAgentManifest, computePushHash } from "@/utils/manifest";
import { validateCompiledIR } from "@/utils/validate";
import { resolveProvider } from "@/utils/providers";
import { exportCompiledIrForDebug } from "@/utils/ir/export";
import { pushRemoteManifest } from "./upload-manifest";
import { ensureAgentState, createInitialState } from "./agent-state";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export async function uploadMcpConfig(
  cwd: string,
  wranglerConfigPath: string,
): Promise<void> {
  const mcpConfigPath = join(cwd, ".kalp", "generated", "mcp-config.json");
  const mcpConfigRaw = await readFile(mcpConfigPath, "utf-8").catch(() => null);
  if (!mcpConfigRaw) return;
  const provider = resolveProvider();
  await provider
    .putValue({
      cwd,
      configPath: wranglerConfigPath,
      key: "mcp:config",
      value: mcpConfigRaw,
    })
    .catch(() => {
      p.log.warn("Could not upload MCP config to KV");
    });
}

export type PushOutcome =
  | { status: "skipped" }
  | {
      status: "pushed";
      agentState: ReturnType<typeof ensureAgentState>;
      manifest: Awaited<
        ReturnType<typeof readAgentManifest>
      > & { hash: string };
    }
  | { status: "failed"; error: string };

export async function pushSingleAgent(params: {
  cwd: string;
  agentName: string;
  agentPath: string;
  state: ReturnType<typeof createInitialState>;
  wranglerConfigPath: string;
  spinner: ReturnType<typeof p.spinner>;
}): Promise<PushOutcome> {
  const { cwd, agentName, agentPath, state, wranglerConfigPath, spinner } =
    params;

  const exists = await access(agentPath).then(() => true).catch(() => false);
  if (!exists) return { status: "failed", error: `missing ${agentPath}` };

  try {
    spinner.start(`Compiling ${pc.cyan(agentName)}`);
    const manifest = await readAgentManifest({ cwd, agentName });
    const hash = computePushHash(manifest);
    const validation = validateCompiledIR({ agentName, manifest, hash });
    if (!validation.ok) {
      const details = (validation.errors ?? []).join(" | ");
      throw new Error(
        `validation failed (${validation.phase})${details ? `: ${details}` : ""}`,
      );
    }

    const agentState = ensureAgentState(state, agentName, agentPath);
    if (agentState.lastRemoteHash === hash) {
      spinner.stop(`Skipped ${pc.cyan(agentName)} (no changes)`);
      return { status: "skipped" };
    }

    spinner.message(
      `Uploading agent ${pc.cyan(agentName)} to remote runtime`,
    );
    await pushRemoteManifest({
      cwd,
      wranglerConfigPath,
      agentName,
      hash,
      manifest,
    });

    agentState.currentVersion = Math.max(0, agentState.currentVersion) + 1;
    agentState.currentHash = hash;
    agentState.lastPushedAt = new Date().toISOString();
    agentState.workerUrl = state.workerUrl
      ? `${state.workerUrl.replace(/\/$/, "")}/a/${agentName}`
      : agentState.workerUrl;

    await exportCompiledIrForDebug({ cwd, agentName, manifest });

    const totalSize = Object.values(manifest.bundles).reduce(
      (sum, bundle) => sum + Buffer.byteLength(bundle.code),
      0,
    );
    const handlerCount = Object.keys(manifest.bundles).length;
    spinner.stop(
      `${pc.bold(agentName)} pushed ${pc.dim(`(v${agentState.currentVersion})`)} · ${handlerCount} handlers · ${formatBytes(totalSize)}`,
    );
    return {
      status: "pushed",
      agentState,
      manifest: { ...manifest, hash },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    spinner.stop(`Failed ${pc.cyan(agentName)}`);
    return { status: "failed", error: message };
  }
}
