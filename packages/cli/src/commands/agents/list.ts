import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { requireAuth } from "@/utils/auth";
import {
  type RemoteAgentIndexEntry,
  readRemoteAgentsIndex,
} from "@/utils/agents-remote";
import { resolveSecretsRuntimeConfigPath } from "@/utils/secrets-runtime";

const LOGO = "🦋";
const CACHE_TTL_MS = 20_000;

interface RemoteAgentListCache {
  cachedAt: string;
  entries: RemoteAgentIndexEntry[];
}

function pad(value: string, width: number): string {
  return value.length >= width
    ? value
    : `${value}${" ".repeat(width - value.length)}`;
}

function renderTable(rows: RemoteAgentIndexEntry[]): void {
  const headers = {
    name: "Agent",
    version: "Version",
    updated: "Updated",
    status: "Status",
  };

  const widths = {
    name: Math.max(headers.name.length, ...rows.map((r) => r.name.length), 5),
    version: Math.max(
      headers.version.length,
      ...rows.map((r) => (r.version ?? "—").length),
      7,
    ),
    updated: Math.max(
      headers.updated.length,
      ...rows.map((r) => (r.updatedAt || "—").length),
      7,
    ),
    status: headers.status.length,
  };

  const divider = `  ${"-".repeat(widths.name)}  ${"-".repeat(widths.version)}  ${"-".repeat(widths.updated)}  ${"-".repeat(widths.status)}`;
  console.log(
    `  ${pc.bold(pad(headers.name, widths.name))}  ${pc.bold(pad(headers.version, widths.version))}  ${pc.bold(pad(headers.updated, widths.updated))}  ${pc.bold(pad(headers.status, widths.status))}`,
  );
  console.log(pc.dim(divider));

  for (const row of rows) {
    const version = row.version ?? "—";
    const updated = row.updatedAt || "—";
    const statusText = "online";
    const status = `${pc.green(statusText)}${" ".repeat(Math.max(0, widths.status - statusText.length))}`;
    console.log(
      `  ${pad(row.name, widths.name)}  ${pad(version, widths.version)}  ${pad(updated, widths.updated)}  ${status}`,
    );
  }
}

function getCachePath(cwd: string): string {
  return join(cwd, ".kalp", "cache", "agents-list-remote.json");
}

async function readCache(cwd: string): Promise<RemoteAgentListCache | null> {
  const cachePath = getCachePath(cwd);
  try {
    await access(cachePath);
  } catch {
    return null;
  }

  const raw = await readFile(cachePath, "utf-8").catch(() => null);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as RemoteAgentListCache;
    if (!parsed || !Array.isArray(parsed.entries) || !parsed.cachedAt) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function writeCache(
  cwd: string,
  entries: RemoteAgentIndexEntry[],
): Promise<void> {
  const cachePath = getCachePath(cwd);
  await mkdir(dirname(cachePath), { recursive: true });
  const payload: RemoteAgentListCache = {
    cachedAt: new Date().toISOString(),
    entries,
  };
  await writeFile(cachePath, JSON.stringify(payload, null, 2), "utf-8");
}

function isFresh(cache: RemoteAgentListCache): boolean {
  const cachedAt = Date.parse(cache.cachedAt);
  if (!Number.isFinite(cachedAt)) return false;
  return Date.now() - cachedAt <= CACHE_TTL_MS;
}

export default defineCommand({
  meta: {
    name: "list",
    description: "List remote agents",
  },
  args: {
    refresh: {
      type: "boolean",
      description: "Force refresh remote data (skip cache)",
      default: false,
    },
    help: {
      type: "boolean",
      alias: "h",
      default: false,
      description: "Show help",
    },
  },
  async run({ args }) {
    if (args.help) {
      p.log.info(`${pc.bold("Usage")}: kalp agents list [--refresh]`);
      return;
    }

    const cwd = process.cwd();
    p.intro(`${LOGO} ${pc.bold("kalp agents list")}`);

    await requireAuth().catch(() => {
      p.log.error("Not authenticated. Run `kalp login` first.");
      process.exit(1);
    });

    const spinner = p.spinner();
    spinner.start("Loading remote agents");

    try {
      const cache = args.refresh ? null : await readCache(cwd);
      let entries: RemoteAgentIndexEntry[];

      if (cache && isFresh(cache)) {
        entries = cache.entries;
        spinner.stop(
          `Loaded ${entries.length} agents ${pc.dim("(cached, remote)")}`,
        );
      } else {
        const configPath = await resolveSecretsRuntimeConfigPath(cwd);
        entries = await readRemoteAgentsIndex(cwd, configPath);
        await writeCache(cwd, entries).catch(() => null);
        spinner.stop(`Loaded ${entries.length} agents from remote runtime`);
      }

      const rows = [...entries].sort((a, b) => a.name.localeCompare(b.name));
      if (rows.length === 0) {
        p.log.info(pc.dim("No remote agents found."));
        return;
      }

      renderTable(rows);
    } catch (error) {
      spinner.stop("Failed to load remote agents");
      p.log.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  },
});
