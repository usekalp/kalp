import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { requireAuth } from "@/utils/auth";
import { resolveProvider } from "@/utils/providers";
import { readLocalSecretsFromConfig } from "@/utils/secrets-config";
import { resolveSecretsRuntimeConfigPath } from "@/utils/secrets-runtime";

const LOGO = "🦋";

export default defineCommand({
  meta: {
    name: "list",
    description: "List remote runtime secrets",
  },
  args: {
    help: {
      type: "boolean",
      alias: "h",
      description: "Show help",
      default: false,
    },
  },
  async run({ args }) {
    const cwd = process.cwd();

    if (args.help) {
      p.log.info(`${pc.bold("Usage")}: kalp secrets list`);
      return;
    }

    p.intro(`${LOGO} ${pc.bold("kalp secrets list")}`);

    await requireAuth().catch(() => {
      p.log.error("Not authenticated. Run `kalp login` first.");
      process.exit(1);
    });

    const spinner = p.spinner();
    spinner.start("Loading remote secrets");

    try {
      const configPath = await resolveSecretsRuntimeConfigPath(cwd);
      const provider = resolveProvider();
      const [remoteSecrets, localSecrets] = await Promise.all([
        provider.listSecrets({ cwd, configPath }),
        readLocalSecretsFromConfig(cwd),
      ]);

      const remoteNames = remoteSecrets.map((item) => item.name).sort((a, b) => a.localeCompare(b));
      const syncedCount = remoteNames.filter((name) => localSecrets.includes(name)).length;
      spinner.stop(`Found ${remoteNames.length} remote secrets`);

      if (remoteNames.length === 0) {
        p.log.info(pc.dim("No remote secrets found."));
        p.log.info(pc.dim(`Add one with ${pc.cyan("kalp secrets add -k KEY -v VALUE")}`));
        p.outro("Done");
        return;
      }

      p.log.info(pc.bold("Remote runtime secrets"));
      for (const name of remoteNames) {
        const synced = localSecrets.includes(name);
        const icon = synced ? pc.green("✓") : pc.yellow("○");
        console.log(`  ${icon} ${pc.cyan(name)}`);
      }

      if (syncedCount !== remoteNames.length) {
        const missingLocal = remoteNames.filter((name) => !localSecrets.includes(name));
        p.log.warn(
          `Missing in kalp.config.ts: ${missingLocal.map((name) => pc.cyan(name)).join(", ")}`,
        );
      }

      const localOnly = localSecrets.filter((name) => !remoteNames.includes(name));
      if (localOnly.length > 0) {
        p.log.warn(
          `Local-only secrets (not remote): ${localOnly.map((name) => pc.cyan(name)).join(", ")}`,
        );
      }

      p.outro("Done");
    } catch (error) {
      spinner.stop("Failed to load secrets");
      p.log.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  },
});
