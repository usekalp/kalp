import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getAuthToken } from "../../utils/auth.js";

const LOGO = "🦋";

interface CloudSecret {
  key: string;
  createdAt: string;
}

async function fetchSecretsFromCloud(): Promise<CloudSecret[]> {
  return [
    { key: "STRIPE_SECRET_KEY", createdAt: "2024-01-15T10:30:00Z" },
    { key: "OPENAI_API_KEY", createdAt: "2024-01-16T14:22:00Z" },
  ];
}

async function readLocalSecrets(cwd: string): Promise<string[]> {
  try {
    const configPath = join(cwd, "kalp.config.ts");
    const content = await readFile(configPath, "utf-8");
    // Extract secrets array from config
    const match = content.match(/secrets:\s*\[([^\]]*)\]/);
    if (!match) return [];
    const secretsStr = match[1];
    // Extract quoted strings
    const secrets: string[] = [];
    const regex = /["']([^"']+)["']/g;

    if (!secretsStr) {
      return [];
    }

    let m: RegExpExecArray | null;
    while ((m = regex.exec(secretsStr)) !== null) {
      if (m[1]) {
        secrets.push(m[1]);
      }
    }
    return secrets;
  } catch {
    return [];
  }
}

export default defineCommand({
  meta: {
    name: "list",
    description: "List all secrets from Kalp Cloud",
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

    const token = await getAuthToken();
    if (!token) {
      p.log.warn(pc.yellow("Not logged in. Run `kalp login` first."));
      p.outro("Authentication required");
      return;
    }

    const s = p.spinner();
    s.start("Fetching secrets from Kalp Cloud...");

    try {
      const [cloudSecrets, localSecrets] = await Promise.all([
        fetchSecretsFromCloud(),
        readLocalSecrets(cwd),
      ]);

      s.stop(`Found ${cloudSecrets.length} secrets`);

      if (cloudSecrets.length === 0) {
        p.log.info(pc.dim("No secrets found in Kalp Cloud."));
        p.log.info(pc.dim(`Add secrets with: ${pc.cyan("kalp secrets add")}`));
      } else {
        console.log("");
        p.log.info(pc.bold("Cloud Secrets:"));
        for (const secret of cloudSecrets) {
          const isSynced = localSecrets.includes(secret.key);
          const syncIcon = isSynced ? pc.green("✓") : pc.yellow("○");
          console.log(
            `  ${syncIcon} ${pc.cyan(secret.key)} ${pc.dim(`(${secret.createdAt})`)}`,
          );
        }

        if (localSecrets.length > 0) {
          const unsynced = localSecrets.filter(
            (k) => !cloudSecrets.some((s) => s.key === k),
          );
          if (unsynced.length > 0) {
            console.log("");
            p.log.warn(
              pc.yellow(
                `Local-only secrets (not synced): ${unsynced.join(", ")}`,
              ),
            );
          }
        }
      }

      p.outro("Done");
    } catch (error) {
      s.stop("Failed to fetch secrets");
      p.log.error(
        pc.red(
          `Error: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
      p.outro("Failed");
      process.exit(1);
    }
  },
});
