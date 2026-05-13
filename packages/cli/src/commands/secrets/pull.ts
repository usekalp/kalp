import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { requireAuth } from "@/utils/auth";
import { generateTypes } from "@/utils/codegen";
import { resolveProvider } from "@/utils/providers";
import {
  filterInternalSecrets,
  mergeSecrets,
  readLocalSecretsFromConfig,
  writeLocalSecretsToConfig,
} from "@/utils/secrets-config";
import { resolveSecretsRuntimeConfigPath } from "@/utils/secrets-runtime";

const LOGO = "🦋";

export default defineCommand({
  meta: {
    name: "pull",
    description: "Pull remote secrets into local kalp.config.ts",
  },
  args: {
    includeInternal: {
      type: "boolean",
      description: "Include internal Kalp runtime secrets (KALP_*)",
      default: false,
    },
  },
  async run({ args }) {
    const cwd = process.cwd();

    p.intro(`${LOGO} ${pc.bold("kalp secrets pull")}`);

    await requireAuth().catch(() => {
      p.log.error("Not authenticated. Run `kalp login` first.");
      process.exit(1);
    });

    const spinner = p.spinner();
    spinner.start("Reading remote secrets");

    try {
      const configPath = await resolveSecretsRuntimeConfigPath(cwd);
      const provider = resolveProvider();
      const [remoteSecrets, localSecrets] = await Promise.all([
        provider.listSecrets({ cwd, configPath }),
        readLocalSecretsFromConfig(cwd),
      ]);

      const remoteNames = filterInternalSecrets(
        remoteSecrets.map((secret) => secret.name),
        args.includeInternal,
      );
      const merged = mergeSecrets(localSecrets, remoteNames);
      const added = merged.filter((name) => !localSecrets.includes(name));

      await writeLocalSecretsToConfig(cwd, merged);
      await generateTypes(cwd);

      spinner.stop(`Pulled ${remoteNames.length} remote secrets`);
      if (added.length > 0) {
        p.log.success(
          `Added to local config: ${added.map((name) => pc.cyan(name)).join(", ")}`,
        );
      } else {
        p.log.info(pc.dim("Local config already up to date."));
      }
      p.outro("Done");
    } catch (error) {
      spinner.stop("Pull failed");
      p.log.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  },
});
