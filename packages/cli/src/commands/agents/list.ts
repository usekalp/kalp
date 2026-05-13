import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { requireAuth } from "@/utils/auth";
import {
  readRemoteAgentPointers,
  readRemoteAgentsIndex,
} from "@/utils/agents-remote";
import { readProjectState } from "@/utils/project-state";
import { readLocalAgentNames } from "@/utils/runtime";
import { resolveSecretsRuntimeConfigPath } from "@/utils/secrets-runtime";

const LOGO = "🦋";

interface AgentViewRow {
  name: string;
  localStatus: "yes" | "no";
  remoteStatus: "online" | "offline";
  remoteVersion: string;
  updatedAt: string;
}

function pad(value: string, width: number): string {
  return value.length >= width
    ? value
    : `${value}${" ".repeat(width - value.length)}`;
}

function renderTable(rows: AgentViewRow[]): void {
  const headers = {
    name: "Agent",
    local: "Local",
    remote: "Remote",
    version: "Remote Version",
    updated: "Updated",
  };

  const widths = {
    name: Math.max(headers.name.length, ...rows.map((r) => r.name.length), 5),
    local: headers.local.length,
    remote: headers.remote.length,
    version: Math.max(
      headers.version.length,
      ...rows.map((r) => r.remoteVersion.length),
      14,
    ),
    updated: Math.max(headers.updated.length, ...rows.map((r) => r.updatedAt.length), 7),
  };

  const divider = `  ${"-".repeat(widths.name)}  ${"-".repeat(widths.local)}  ${"-".repeat(widths.remote)}  ${"-".repeat(widths.version)}  ${"-".repeat(widths.updated)}`;
  console.log(
    `  ${pc.bold(pad(headers.name, widths.name))}  ${pc.bold(pad(headers.local, widths.local))}  ${pc.bold(pad(headers.remote, widths.remote))}  ${pc.bold(pad(headers.version, widths.version))}  ${pc.bold(pad(headers.updated, widths.updated))}`,
  );
  console.log(pc.dim(divider));
  for (const row of rows) {
    const localText = row.localStatus === "yes" ? "yes" : "no";
    const remoteText = row.remoteStatus === "online" ? "online" : "offline";
    const local =
      row.localStatus === "yes" ? pc.green(localText) : pc.dim(localText);
    const remote =
      row.remoteStatus === "online" ? pc.green(remoteText) : pc.dim(remoteText);
    const localCell = `${local}${" ".repeat(Math.max(0, widths.local - localText.length))}`;
    const remoteCell = `${remote}${" ".repeat(Math.max(0, widths.remote - remoteText.length))}`;
    console.log(
      `  ${pad(row.name, widths.name)}  ${localCell}  ${remoteCell}  ${pad(row.remoteVersion, widths.version)}  ${pad(row.updatedAt, widths.updated)}`,
    );
  }
}

export default defineCommand({
  meta: {
    name: "list",
    description: "List local agents and compare with remote runtime",
  },
  args: {
    help: {
      type: "boolean",
      alias: "h",
      default: false,
      description: "Show help",
    },
  },
  async run({ args }) {
    if (args.help) {
      p.log.info(`${pc.bold("Usage")}: kalp agents list`);
      return;
    }

    const cwd = process.cwd();
    p.intro(`${LOGO} ${pc.bold("kalp agents list")}`);

    await requireAuth().catch(() => {
      p.log.error("Not authenticated. Run `kalp login` first.");
      process.exit(1);
    });

    const spinner = p.spinner();
    spinner.start("Loading local and remote agent status");

    try {
      const configPath = await resolveSecretsRuntimeConfigPath(cwd);
      const [localNames, state, indexEntries, remotePointers] =
        await Promise.all([
          readLocalAgentNames(cwd),
          readProjectState(cwd),
          readRemoteAgentsIndex(cwd, configPath),
          readRemoteAgentPointers(cwd, configPath),
        ]);

      const localSet = new Set(localNames);
      const remoteIndexByName = new Map(
        indexEntries.map((entry) => [entry.name, entry]),
      );
      const remotePointerByName = new Map(
        remotePointers.map((entry) => [entry.name, entry.hash]),
      );
      const names = [
        ...new Set([
          ...localNames,
          ...remotePointerByName.keys(),
          ...remoteIndexByName.keys(),
        ]),
      ].sort((a, b) => a.localeCompare(b));

      const rows: AgentViewRow[] = names.map((name) => {
        const index = remoteIndexByName.get(name);
        const remoteExists = remotePointerByName.has(name) || !!index;
        const stateAgent = state?.agents?.[name];
        const remoteVersion =
          index?.version ??
          (typeof index?.versionNumber === "number" && index.versionNumber > 0
            ? `v${index.versionNumber}`
            : stateAgent?.lastRemoteHash
              ? `v${stateAgent.currentVersion}`
              : "—");
        return {
          name,
          localStatus: localSet.has(name) ? "yes" : "no",
          remoteStatus: remoteExists ? "online" : "offline",
          remoteVersion,
          updatedAt: index?.updatedAt ?? stateAgent?.lastPushedAt ?? "—",
        };
      });

      spinner.stop(`Found ${rows.length} agents`);
      if (rows.length === 0) {
        p.log.info(pc.dim("No agents found locally or remotely."));
        p.outro("Done");
        return;
      }

      renderTable(rows);
      p.outro("Done");
    } catch (error) {
      spinner.stop("Failed to load agent status");
      p.log.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  },
});
