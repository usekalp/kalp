import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { requireAuth } from "@/utils/auth";
import { generateTypes } from "@/utils/codegen";
import { resolveProvider } from "@/utils/providers";
import { readLocalSecretsFromConfig, writeLocalSecretsToConfig } from "@/utils/secrets-config";
import { resolveSecretsRuntimeConfigPath } from "@/utils/secrets-runtime";

const LOGO = "🦋";

export default defineCommand({
  meta: {
    name: "delete",
    description: "Delete a secret from remote runtime and local config",
  },
  args: {
    key: {
      type: "string",
      alias: "k",
      description: "Secret key to delete",
    },
    yes: {
      type: "boolean",
      alias: "y",
      description: "Skip confirmation prompt",
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
    const cwd = process.cwd();

    if (args.help) {
      p.log.info(`${pc.bold("Usage")}: kalp secrets delete -k <KEY>`);
      return;
    }

    p.intro(`${LOGO} ${pc.bold("kalp secrets delete")}`);

    await requireAuth().catch(() => {
      p.log.error("Not authenticated. Run `kalp login` first.");
      process.exit(1);
    });

    let configPath: string;
    try {
      configPath = await resolveSecretsRuntimeConfigPath(cwd);
    } catch (error) {
      p.log.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }

    const provider = resolveProvider();
    let remoteSecrets;
    try {
      remoteSecrets = await provider.listSecrets({ cwd, configPath });
    } catch (error) {
      p.log.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }

    if (!remoteSecrets || remoteSecrets.length === 0) {
      p.log.info(pc.dim("No remote secrets to delete."));
      p.outro("Done");
      return;
    }

    let key = args.key?.trim();
    if (!key) {
      const selected = await p.select({
        message: "Select a secret to delete",
        options: remoteSecrets
          .map((secret) => secret.name)
          .sort((a, b) => a.localeCompare(b))
          .map((name) => ({ value: name, label: name })),
      });
      if (p.isCancel(selected)) {
        p.outro("Cancelled");
        return;
      }
      key = String(selected);
    }

    const existsRemote = remoteSecrets.some((secret) => secret.name === key);
    if (!existsRemote) {
      p.log.error(`Secret ${pc.cyan(key)} not found in remote runtime.`);
      process.exit(1);
    }

    if (!args.yes) {
      const confirmed = await p.confirm({
        message: `Delete ${pc.cyan(key)} from remote runtime and local config?`,
        initialValue: false,
      });
      if (p.isCancel(confirmed) || !confirmed) {
        p.outro("Cancelled");
        return;
      }
    }

    const spinner = p.spinner();
    spinner.start(`Deleting ${pc.cyan(key)}`);

    try {
      await provider.deleteSecret({ cwd, configPath, name: key });
      const localSecrets = await readLocalSecretsFromConfig(cwd);
      await writeLocalSecretsToConfig(
        cwd,
        localSecrets.filter((secret) => secret !== key),
      );
      await generateTypes(cwd);

      spinner.stop(`Secret ${pc.cyan(key)} deleted`);
      p.outro("Done");
    } catch (error) {
      spinner.stop("Failed to delete secret");
      p.log.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  },
});
