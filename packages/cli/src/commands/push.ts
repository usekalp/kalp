import { join } from "node:path";
import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { ensureConfig } from "@/utils/fs";
import { generateTypes } from "@/utils/codegen";
import { requireAuth } from "@/utils/auth";
import { runInitialDeploy, ensureKvNamespaceBindingId } from "@/utils/deploy";
import { readProjectState, writeProjectState } from "@/utils/project-state";
import { materializeRuntime, readLocalAgentNames } from "@/utils/runtime";
import { resolveProvider } from "@/utils/providers";
import { showKalpCloudWaitlist } from "@/utils/deploy-target";
import { loadProjectConfig } from "@/utils/project-config";
import {
  collectMcpSecretRequirements,
  type KalpProjectConfig,
} from "@kalphq/sdk";
import {
  readRemoteAgentsIndex,
  writeRemoteAgentsIndex,
  pruneStaleRemoteAgents,
} from "@/utils/push/remote-index";
import {
  createInitialState,
  ensureAgentState,
  hydrateLocalAgentVersionsFromRemoteIndex,
} from "@/utils/push/agent-state";
import {
  uploadMcpConfig,
  pushSingleAgent,
} from "@/utils/push/upload-helpers";
import type { PushResult } from "@/utils/push/upload-manifest";

const LOGO = "\u{1F98B}";

async function validateRemoteMcpSecrets(
  cwd: string,
  wranglerConfigPath: string,
  requiredSecrets: string[],
  strict: boolean,
): Promise<void> {
  const provider = resolveProvider();
  const remoteSecrets = await provider
    .listSecrets({ cwd, configPath: wranglerConfigPath })
    .catch(() => []);
  const remoteSecretNames = new Set(remoteSecrets.map((s) => s.name));
  const missing = requiredSecrets.filter((s) => !remoteSecretNames.has(s));

  if (missing.length > 0) {
    p.log.warn(
      `${pc.yellow("⚠️  Missing MCP secrets detected in remote runtime:")}\n` +
        missing.map((m) => `   - ${pc.bold(m)}`).join("\n"),
    );
    if (strict) {
      p.log.error(
        pc.red("Push aborted due to missing required secrets (--strict-secrets is enabled)."),
      );
      process.exit(1);
    }
    p.log.info(
      pc.dim("Deployment will continue. You can add them later with `kalp secrets add`."),
    );
  }
}

async function resolveDeployTarget(cwd: string): Promise<{
  state: ReturnType<typeof createInitialState>;
  deployed: boolean;
}> {
  const state = (await readProjectState(cwd)) ?? createInitialState();
  if (state.workerUrl) return { state, deployed: false };

  const deployTarget = await p.select({
    message: "No remote runtime detected yet. Where do you want to deploy?",
    options: [
      { value: "cloudflare", label: "\u2601\uFE0F  Cloudflare (your account)" },
      { value: "kalp-cloud", label: "\u{1F98B} Kalp Cloud (managed)" },
    ],
  });

  if (p.isCancel(deployTarget) || !deployTarget) {
    p.outro("Cancelled");
    process.exit(0);
  }
  if (deployTarget === "kalp-cloud") {
    showKalpCloudWaitlist();
    p.outro(pc.green("Got it \u2014 you'll hear from us soon."));
    process.exit(0);
  }
  const s = p.spinner();
  s.start("Deploying");
  const deploy = await runInitialDeploy(cwd);
  s.stop("Deployed");
  const refreshed = (await readProjectState(cwd)) ?? createInitialState();
  refreshed.workerUrl = deploy.workerUrl;
  refreshed.accountId = deploy.accountId;
  refreshed.deployedAt = new Date().toISOString();
  return { state: refreshed, deployed: true };
}

export default defineCommand({
  meta: { name: "push", description: "Upload agents to remote runtime" },
  args: {
    agent: {
      type: "string",
      alias: "a",
      description: "Agent name to push",
      required: false,
    },
    strictSecrets: {
      type: "boolean",
      description: "Fail if required MCP secrets are missing from remote runtime",
      required: false,
      default: false,
    },
  },
  async run({ args }) {
    const cwd = process.cwd();
    const isBulkPush = !args.agent;

    p.intro(`${LOGO} ${pc.bold("kalp push")}`);

    await ensureConfig(cwd).catch(() => {
      p.log.error(`${pc.cyan("kalp.config.ts")} not found`);
      process.exit(1);
    });

    await generateTypes(cwd);

    const availableAgents = await readLocalAgentNames(cwd);
    if (availableAgents.length === 0) {
      p.log.error("No local agents found in ./agents");
      process.exit(1);
    }

    let selectedAgents: string[] = [];
    if (args.agent) {
      if (!availableAgents.includes(args.agent)) {
        p.log.error(`Agent ${pc.cyan(args.agent)} not found`);
        process.exit(1);
      }
      selectedAgents = [args.agent];
    } else {
      selectedAgents = availableAgents;
    }

    await requireAuth().catch(() => {
      p.log.error("Not authenticated. Run `kalp login` first.");
      process.exit(1);
    });

    const { state } = await resolveDeployTarget(cwd);
    let runtime = await materializeRuntime(cwd);

    const kvId = await ensureKvNamespaceBindingId(
      cwd,
      runtime.wranglerConfigPath,
    );
    if (!kvId) {
      p.log.error("Could not resolve storage namespace. Run `kalp deploy` first.");
      process.exit(1);
    }

    const { raw: config } = await loadProjectConfig(cwd);
    const requiredMcpSecrets = collectMcpSecretRequirements(
      config as unknown as KalpProjectConfig,
    );
    if (requiredMcpSecrets.length > 0) {
      await validateRemoteMcpSecrets(
        cwd,
        runtime.wranglerConfigPath,
        requiredMcpSecrets,
        args.strictSecrets ?? false,
      );
    }

    let remoteIndex = await readRemoteAgentsIndex(cwd, runtime.wranglerConfigPath);
    await uploadMcpConfig(cwd, runtime.wranglerConfigPath);

    for (const agentName of availableAgents) {
      const agentPath = join(cwd, "agents", agentName, "index.ts");
      ensureAgentState(state, agentName, agentPath);
    }
    hydrateLocalAgentVersionsFromRemoteIndex({ state, remoteEntries: remoteIndex, cwd });

    if (isBulkPush) {
      const prune = await pruneStaleRemoteAgents({
        cwd,
        wranglerConfigPath: runtime.wranglerConfigPath,
        remoteEntries: remoteIndex,
        localAgentNames: availableAgents,
      });
      if (prune.removedAgents.length > 0) {
        p.log.info(`Pruned stale agents: ${pc.cyan(prune.removedAgents.join(", "))}`);
        remoteIndex = remoteIndex.filter((entry) => !prune.removedAgents.includes(entry.name));
      }
    }

    const remoteIndexByName = new Map(remoteIndex.map((entry) => [entry.name, entry]));

    const spinner = p.spinner();
    const result: PushResult = { pushed: 0, skipped: 0, failed: 0 };
    const failures: string[] = [];

    for (const agentName of selectedAgents) {
      const agentPath = join(cwd, "agents", agentName, "index.ts");
      const outcome = await pushSingleAgent({
        cwd,
        agentName,
        agentPath,
        state,
        wranglerConfigPath: runtime.wranglerConfigPath,
        spinner,
      });
      switch (outcome.status) {
        case "skipped":
          result.skipped += 1;
          break;
        case "pushed": {
          result.pushed += 1;
          const { agentState, manifest } = outcome;
          agentState.lastRemoteHash = manifest.hash;
          agentState.lastLocalHash = manifest.hash;
          remoteIndexByName.set(agentName, {
            name: agentName,
            hash: manifest.hash,
            version: `v${agentState.currentVersion}`,
            versionNumber: agentState.currentVersion,
            updatedAt: agentState.lastPushedAt || new Date().toISOString(),
            workerUrl: agentState.workerUrl,
            label: manifest.semanticIr.agent?.label,
            tags: manifest.semanticIr.agent?.tags,
          });
          break;
        }
        case "failed":
          result.failed += 1;
          failures.push(`${agentName}: ${outcome.error}`);
          break;
      }
    }

    if (result.pushed > 0) {
      await writeRemoteAgentsIndex(
        cwd,
        runtime.wranglerConfigPath,
        Array.from(remoteIndexByName.values()).sort((a, b) => a.name.localeCompare(b.name)),
      );
    }

    await writeProjectState(cwd, state);
    await materializeRuntime(cwd);

    p.note(
      `Successfully pushed ${result.pushed} agents. ${result.skipped} omitted (no changes). ${result.failed} failed.`,
      "Remote push",
    );

    if (failures.length > 0) {
      for (const failure of failures) {
        p.log.error(failure);
      }
      p.outro(`${LOGO} ${pc.red("Push completed with failures")}`);
      process.exit(1);
    }

    p.outro(`${LOGO} ${pc.green("Push complete")}`);
  },
});
