import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { generateTypes } from "@/utils/codegen";
import { getAuthToken } from "@/utils/auth";

const LOGO = "🦋";

async function addSecretToCloud(key: string, value: string): Promise<void> {
  // TODO: Implement real API call to Kalp Cloud
  console.log(pc.dim(`[Simulated] Adding secret ${key} to Kalp Cloud...`));
}

async function addSecretToLocalConfig(cwd: string, key: string): Promise<void> {
  const configPath = join(cwd, "kalp.config.ts");
  let content: string;

  try {
    content = await readFile(configPath, "utf-8");
  } catch {
    throw new Error(
      "kalp.config.ts not found. Run `npx create-kalp@latest` first.",
    );
  }

  // Check if key already exists
  const regex = new RegExp(`["']${key}["']`);
  if (regex.test(content)) {
    throw new Error(`Secret ${key} already exists in kalp.config.ts`);
  }

  // Add secret to array
  const match = content.match(/secrets:\s*\[([^\]]*)\]/);
  if (!match) {
    throw new Error("Could not find secrets array in kalp.config.ts");
  }

  const currentArray = match[1]?.trim() ?? "";

  const newSecret = currentArray.length > 0 ? `, "${key}"` : `"${key}"`;
  const newArray = `secrets: [${currentArray}${newSecret}]`;

  content = content.replace(/secrets:\s*\[([^\]]*)\]/, newArray);

  await writeFile(configPath, content, "utf-8");
}

async function regenerateTypes(cwd: string): Promise<void> {
  // Regenerate .kalp/types.d.ts based on kalp.config.ts
  await generateTypes(cwd);
}

export default defineCommand({
  meta: {
    name: "add",
    description: "Add a secret to Kalp Cloud and local config",
  },
  args: {
    key: {
      type: "string",
      alias: "k",
      description: "Secret key name (e.g., STRIPE_SECRET_KEY)",
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
      p.log.info(`${pc.bold("Usage")}: kalp secrets add -k <key> -v <value>`);
      p.log.info(
        pc.dim("Example: kalp secrets add -k STRIPE_SECRET_KEY -v sk_test_..."),
      );
      return;
    }

    p.intro(`${LOGO} ${pc.bold("kalp secrets add")}`);

    const token = await getAuthToken();
    if (!token) {
      p.log.warn(pc.yellow("Not logged in. Run `kalp login` first."));
      p.outro("Authentication required");
      return;
    }

    let key = args.key;
    let value = args.value;

    // Interactive prompts if not provided
    if (!key) {
      const input = await p.text({
        message: "Secret key name",
        placeholder: "STRIPE_SECRET_KEY",
        validate: (v) => {
          if (!v) return "Key is required";
          if (!/^[A-Z_][A-Z0-9_]*$/.test(v)) {
            return "Key must be UPPER_SNAKE_CASE";
          }
        },
      });
      if (p.isCancel(input)) {
        p.outro("Cancelled");
        return;
      }
      key = input;
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
      value = input;
    }

    const s = p.spinner();
    s.start(`Adding ${pc.cyan(key)}...`);

    try {
      // Add to cloud (simulated)
      await addSecretToCloud(key, value);

      // Add to local config
      await addSecretToLocalConfig(cwd, key);

      // Regenerate types from config
      await regenerateTypes(cwd);

      s.stop(`Secret ${pc.cyan(key)} added successfully`);
      p.outro("Done");
    } catch (error) {
      s.stop("Failed to add secret");
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
