import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { requireAuth } from "@/utils/auth";
import { generateTypes } from "@/utils/codegen";
import { resolveProvider } from "@/utils/providers";
import {
  mergeSecrets,
  readLocalSecretsFromConfig,
  writeLocalSecretsToConfig,
} from "@/utils/secrets-config";
import { resolveSecretsRuntimeConfigPath } from "@/utils/secrets-runtime";

const LOGO = "🦋";

export default defineCommand({
  meta: {
    name: "add",
    description: "Add a secret to remote runtime and local config",
  },
  args: {
    key: {
      type: "string",
      alias: "k",
      description: "Secret key (UPPER_SNAKE_CASE)",
    },
    value: {
      type: "string",
      alias: "v",
      description: "Secret value",
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
      p.log.info(`${pc.bold("Usage")}: kalp secrets add -k <KEY> -v <VALUE>`);
      return;
    }

    p.intro(`${LOGO} ${pc.bold("kalp secrets add")}`);

    await requireAuth().catch(() => {
      p.log.error("Not authenticated. Run `kalp login` first.");
      process.exit(1);
    });

    let key = args._[0]?.trim() || args.key?.trim();
    let value = args.value;

    if (!key) {
      const input = await p.text({
        message: "Secret key name",
        placeholder: "STRIPE_SECRET_KEY",
        validate: (v) => {
          if (!v) return "Key is required";
          if (!/^[A-Z_][A-Z0-9_]*$/.test(v)) {
            return "Key must be UPPER_SNAKE_CASE";
          }
          if (v.startsWith("KALP_")) {
            return "Secrets starting with KALP_ are reserved";
          }
        },
      });
      if (p.isCancel(input)) {
        p.outro("Cancelled");
        return;
      }
      key = String(input).trim();
    }

    if (!/^[A-Z_][A-Z0-9_]*$/.test(key)) {
      p.log.error("Invalid key. Use UPPER_SNAKE_CASE.");
      process.exit(1);
    }

    if (key.startsWith("KALP_")) {
      p.log.error("Secrets starting with KALP_ are reserved and cannot be added.");
      process.exit(1);
    }

    if (!value) {
      const input = await p.password({
        message: `Enter value for ${key}`,
        mask: "*",
      });
      if (p.isCancel(input)) {
        p.outro("Cancelled");
        return;
      }
      value = String(input);
    }

    const trimmedValue = value.trim();
    if (!trimmedValue) {
      p.log.error("Secret value cannot be empty.");
      process.exit(1);
    }

    const spinner = p.spinner();
    spinner.start(`Adding ${pc.cyan(key)} to remote runtime`);

    try {
      const configPath = await resolveSecretsRuntimeConfigPath(cwd);
      const provider = resolveProvider();
      await provider.putSecret({
        cwd,
        configPath,
        name: key,
        value: trimmedValue,
      });

      const localSecrets = await readLocalSecretsFromConfig(cwd);
      const merged = mergeSecrets(localSecrets, [key]);
      await writeLocalSecretsToConfig(cwd, merged);
      await generateTypes(cwd);

      spinner.stop(`Secret ${pc.cyan(key)} added`);
      p.outro("Done");
    } catch (error) {
      spinner.stop("Failed to add secret");
      p.log.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  },
});
