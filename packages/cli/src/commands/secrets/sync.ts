import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getAuthToken } from "@/utils/auth";
import { generateTypes } from "@/utils/codegen";

const LOGO = "🦋";

interface SecretFromCloud {
  key: string;
  createdAt: string;
}

async function fetchSecretsFromCloud(): Promise<SecretFromCloud[]> {
  // TODO: Implement real API call to Kalp Cloud
  console.log(pc.dim("[Simulated] Fetching secrets from Kalp Cloud..."));
  // Simulated response - in real implementation, this would call the API
  return [
    { key: "STRIPE_SECRET_KEY", createdAt: "2024-01-15T10:30:00Z" },
    { key: "OPENAI_API_KEY", createdAt: "2024-01-16T14:20:00Z" },
  ];
}

async function replaceSecretsInConfig(
  cwd: string,
  secrets: string[],
): Promise<void> {
  const configPath = join(cwd, "kalp.config.ts");
  let content: string;

  try {
    content = await readFile(configPath, "utf-8");
  } catch {
    // Create new config if doesn't exist
    content = `import { defineConfig } from "@kalphq/sdk";

export default defineConfig({
  secrets: [],
});
`;
  }

  // Replace secrets array with new ones
  const secretsArray =
    secrets.length > 0 ? secrets.map((s) => `"${s}"`).join(", ") : "";

  const newArray = `secrets: [${secretsArray}]`;

  // Check if config has secrets array
  if (content.match(/secrets:\s*\[([^\]]*)\]/)) {
    content = content.replace(/secrets:\s*\[([^\]]*)\]/, newArray);
  } else {
    // Add secrets array if not present
    content = content.replace(
      /defineConfig\({/,
      `defineConfig({\n  secrets: [${secretsArray}],`,
    );
  }

  await writeFile(configPath, content, "utf-8");
}

export default defineCommand({
  meta: {
    name: "sync",
    description: "Sync secrets from Kalp Cloud to local config",
  },
  async run() {
    const cwd = process.cwd();

    p.intro(`${LOGO} ${pc.bold("kalp secrets sync")}`);

    // Check authentication
    const token = await getAuthToken();
    if (!token) {
      p.log.error("Not authenticated. Run 'kalp login' first.");
      process.exit(1);
    }

    const s = p.spinner();

    try {
      s.start("Fetching secrets from Kalp Cloud");
      const cloudSecrets = await fetchSecretsFromCloud();
      s.stop(`Found ${pc.cyan(String(cloudSecrets.length))} secrets in cloud`);

      if (cloudSecrets.length === 0) {
        p.log.warn("No secrets found in Kalp Cloud");

        const shouldClear = await p.confirm({
          message: "Clear local secrets config?",
          initialValue: false,
        });

        if (p.isCancel(shouldClear) || !shouldClear) {
          p.outro("Cancelled");
          return;
        }

        s.start("Clearing local secrets");
        await replaceSecretsInConfig(cwd, []);
        await generateTypes(cwd);
        s.stop("Local secrets cleared");
        p.outro("Done");
        return;
      }

      // Show secrets that will be synced
      p.log.info(pc.bold("Secrets to sync:"));
      for (const secret of cloudSecrets) {
        console.log(`  ${pc.dim("•")} ${pc.cyan(secret.key)}`);
      }

      const confirm = await p.confirm({
        message: `Replace local secrets with ${cloudSecrets.length} secrets from cloud?`,
        initialValue: true,
      });

      if (p.isCancel(confirm) || !confirm) {
        p.outro("Cancelled");
        return;
      }

      s.start("Updating local config");
      const secretKeys = cloudSecrets.map((s) => s.key);
      await replaceSecretsInConfig(cwd, secretKeys);
      s.stop("Config updated");

      s.start("Regenerating types");
      await generateTypes(cwd);
      s.stop("Types regenerated");

      p.log.success(pc.green(`Synced ${cloudSecrets.length} secrets`));
      p.outro("Done");
    } catch (error) {
      s.stop("Sync failed");
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
