import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { requireAuth } from "@/utils/auth";
import {
  readRemoteAgentPointers,
  readRemoteAgentsIndex,
  writeRemoteAgentsIndex,
} from "@/utils/agents-remote";
import { readProjectState, writeProjectState } from "@/utils/project-state";
import { resolveProvider } from "@/utils/providers";
import { resolveSecretsRuntimeConfigPath } from "@/utils/secrets-runtime";

const LOGO = "🦋";

export default defineCommand({
  meta: {
    name: "delete",
    description: "Delete an agent from remote runtime",
  },
  args: {
    agent: {
      type: "string",
      alias: "a",
      description: "Agent name to delete from remote runtime",
      required: true,
    },
    yes: {
      type: "boolean",
      alias: "y",
      description: "Skip confirmation",
      default: false,
    },
    help: {
      type: "boolean",
      alias: "h",
      description: "Show help",
      default: false,
    },
  },
  async run({ args }) {
    if (args.help) {
      p.log.info(`${pc.bold("Usage")}: kalp agents delete -a <agent>`);
      return;
    }

    const cwd = process.cwd();
    p.intro(`${LOGO} ${pc.bold("kalp agents delete")}`);

    await requireAuth().catch(() => {
      p.log.error("Not authenticated. Run `kalp login` first.");
      process.exit(1);
    });

    const spinner = p.spinner();
    spinner.start("Loading remote agents");

    try {
      const configPath = await resolveSecretsRuntimeConfigPath(cwd);
      const provider = resolveProvider();
      const [indexEntries, pointers] = await Promise.all([
        readRemoteAgentsIndex(cwd, configPath),
        readRemoteAgentPointers(cwd, configPath),
      ]);

      const indexByName = new Map(
        indexEntries.map((entry) => [entry.name, entry]),
      );
      const pointerByName = new Map(
        pointers.map((entry) => [entry.name, entry.hash]),
      );
      const remoteNames = [...new Set([...indexByName.keys(), ...pointerByName.keys()])].sort(
        (a, b) => a.localeCompare(b),
      );

      spinner.stop(`Found ${remoteNames.length} remote agents`);
      if (remoteNames.length === 0) {
        p.log.info(pc.dim("No remote agents available to delete."));
        p.outro("Done");
        return;
      }

      const agentName = args.agent?.trim();
      if (!agentName) {
        p.log.error(
          `Agent name is required. Use ${pc.cyan("kalp agents delete -a <agent>")}.`,
        );
        process.exit(1);
      }

      if (!remoteNames.includes(agentName)) {
        p.log.error(`Agent ${pc.cyan(agentName)} is not deployed remotely.`);
        process.exit(1);
      }

      if (!args.yes) {
        const confirm = await p.confirm({
          message: `Delete ${pc.cyan(agentName)} from remote runtime?`,
          initialValue: false,
        });
        if (p.isCancel(confirm) || !confirm) {
          p.log.info("Cancelled.");
          return;
        }
      }

      const hashes = new Set<string>();
      const pointerHash = pointerByName.get(agentName);
      if (pointerHash) hashes.add(pointerHash);
      const indexedHash = indexByName.get(agentName)?.hash;
      if (indexedHash) hashes.add(indexedHash);

      spinner.start(`Deleting ${pc.cyan(agentName)} from remote runtime`);
      const latestKey = `${agentName}:latest`;
      await provider
        .deleteValue({ cwd, configPath, key: latestKey })
        .catch(() => null);
      for (const hash of hashes) {
        await provider
          .deleteValue({ cwd, configPath, key: `${agentName}:${hash}` })
          .catch(() => null);
      }

      const filteredIndex = indexEntries.filter(
        (entry) => entry.name !== agentName,
      );
      await writeRemoteAgentsIndex(cwd, configPath, filteredIndex);

      const state = await readProjectState(cwd);
      if (state?.agents?.[agentName]) {
        state.agents[agentName].lastRemoteHash = null;
        state.agents[agentName].workerUrl = null;
        await writeProjectState(cwd, state);
      }

      spinner.stop(`Deleted remote agent ${pc.cyan(agentName)}`);
      p.log.info(
        pc.dim(
          `Local files were not changed. Delete ./agents/${agentName} manually if you no longer need it.`,
        ),
      );
    } catch (error) {
      spinner.stop("Failed to delete remote agent");
      p.log.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  },
});
