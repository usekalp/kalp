import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getAuthToken } from "../../utils/auth.js";

const LOGO = "🦋";

interface CloudSecret {
  key: string;
}

async function fetchSecretsFromCloud(): Promise<CloudSecret[]> {
  // TODO: Implement real API call to Kalp Cloud
  return [{ key: "STRIPE_SECRET_KEY" }, { key: "OPENAI_API_KEY" }];
}

async function deleteSecretFromCloud(key: string): Promise<void> {
  // TODO: Implement real API call to Kalp Cloud
  console.log(pc.dim(`[Simulated] Deleting secret ${key} from Kalp Cloud...`));
}

async function removeSecretFromLocalConfig(
  cwd: string,
  key: string,
): Promise<void> {
  const configPath = join(cwd, "kalp.config.ts");
  let content: string;

  try {
    content = await readFile(configPath, "utf-8");
  } catch {
    throw new Error("kalp.config.ts not found. Run `kalp init` first.");
  }

  // Check if key exists
  const regex = new RegExp(`["']${key}["']`);
  if (!regex.test(content)) {
    // Key not in local config, that's ok
    throw new Error(`Secret ${key} not found in local config`);
  }

  // Remove secret from array
  const match = content.match(/secrets:\s*\[([^\]]*)\]/);

  if (!match) {
    throw new Error("Could not find secrets array in kalp.config.ts");
  }

  const currentArray = match[1];
  if (!currentArray) {
    throw new Error("Secrets array is empty in kalp.config.ts");
  }

  // Remove the key and clean up commas
  let newArray = currentArray
    .replace(new RegExp(`["']${key}["']\\s*,?\\s*`), "")
    .trim();
  // Remove trailing comma if any
  newArray = newArray.replace(/,\s*$/, "");

  content = content.replace(
    /secrets:\s*\[([^\]]*)\]/,
    `secrets: [${newArray}]`,
  );

  await writeFile(configPath, content, "utf-8");
}

async function removeSecretFromTypes(cwd: string, key: string): Promise<void> {
  const dtsPath = join(cwd, "kalp.d.ts");
  let content: string;

  try {
    content = await readFile(dtsPath, "utf-8");
  } catch {
    // File doesn't exist, nothing to do
    return;
  }

  // Check if key exists
  if (!content.includes(`"${key}"`)) {
    return; // Not there, skip
  }

  // Remove key from the keys tuple
  const match = content.match(/keys:\s*\[([^\]]*)\]/);
  if (!match) {
    return; // No keys array found
  }

  const currentArray = match[1];
  if (!currentArray) {
    return;
  }

  // Remove the key and clean up commas
  let newArray = currentArray
    .replace(new RegExp(`["']${key}["']\\s*,?\\s*`), "")
    .trim();
  // Remove trailing comma if any
  newArray = newArray.replace(/,\s*$/, "");

  content = content.replace(/keys:\s*\[([^\]]*)\]/, `keys: [${newArray}]`);

  await writeFile(dtsPath, content, "utf-8");
}

export default defineCommand({
  meta: {
    name: "delete",
    description: "Delete a secret from Kalp Cloud and local config",
  },
  args: {
    key: {
      type: "string",
      alias: "k",
      description: "Secret key name to delete",
    },
    help: {
      type: "boolean",
      alias: "h",
      description: "Show help",
      default: false,
    },
    yes: {
      type: "boolean",
      alias: "y",
      description: "Skip confirmation",
      default: false,
    },
  },
  async run({ args }) {
    const cwd = process.cwd();

    if (args.help) {
      p.log.info(`${pc.bold("Usage")}: kalp secrets delete -k <key>`);
      p.log.info(pc.dim("Example: kalp secrets delete -k STRIPE_SECRET_KEY"));
      return;
    }

    p.intro(`${LOGO} ${pc.bold("kalp secrets delete")}`);

    const token = await getAuthToken();
    if (!token) {
      p.log.warn(pc.yellow("Not logged in. Run `kalp login` first."));
      p.outro("Authentication required");
      return;
    }

    let key = args.key;

    // Interactive selection if not provided
    if (!key) {
      const secrets = await fetchSecretsFromCloud();
      if (secrets.length === 0) {
        p.log.info(pc.dim("No secrets found in Kalp Cloud."));
        p.outro("Nothing to delete");
        return;
      }

      const selected = await p.select({
        message: "Select a secret to delete",
        options: secrets.map((s) => ({ value: s.key, label: s.key })),
      });

      if (p.isCancel(selected)) {
        p.outro("Cancelled");
        return;
      }

      key = selected as string;
    }

    // Confirmation unless --yes flag
    if (!args.yes) {
      const confirm = await p.confirm({
        message: `Are you sure you want to delete ${pc.cyan(key)}? This action cannot be undone.`,
        initialValue: false,
      });

      if (p.isCancel(confirm) || !confirm) {
        p.outro("Cancelled");
        return;
      }
    }

    const s = p.spinner();
    s.start(`Deleting ${pc.cyan(key)}...`);

    try {
      // Delete from cloud (simulated)
      await deleteSecretFromCloud(key);

      // Remove from local config
      await removeSecretFromLocalConfig(cwd, key);

      // Remove from types
      await removeSecretFromTypes(cwd, key);

      s.stop(`Secret ${pc.cyan(key)} deleted successfully`);
      p.outro("Done");
    } catch (error) {
      s.stop("Failed to delete secret");
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
