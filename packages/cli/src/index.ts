import { defineCommand, runMain } from "citty";
import * as p from "@clack/prompts";
import pc from "picocolors";
import pkg from "../package.json";

const LOGO = "🦋";

const COMMANDS = [
  ["create", "Add a new agent"],
  ["deploy", "Deploy your agents runtime"],
  ["push", "Upload updated agents"],
  ["agents", "List and manage agents"],
  ["secrets", "Manage secrets"],
  ["generate", "Sync project state (types, MCP, etc.)"],
  ["mcp", "Manage MCP tool types"],
  ["login", "Sign in to remote runtime"],
  ["logout", "Sign out from Kalp"],
  ["dev", "Run Worker + Studio locally"],
] as const;

function printHelp(): void {
  p.log.info(`${pc.bold("Usage")}: kalp <command> [options]`);
  console.log("");
  p.log.info(pc.bold("Commands"));

  for (const [name, desc] of COMMANDS) {
    console.log(`  ${pc.cyan(name.padEnd(10))}${desc}`);
  }

  console.log("");
  p.log.info(`Run ${pc.cyan("kalp <command> --help")} for more info.`);
}

const main = defineCommand({
  meta: {
    name: "kalp",
    version: pkg.version,
    description: "🦋 Zero-config agent infrastructure",
  },
  args: {
    help: {
      type: "boolean",
      alias: "h",
      description: "Show help",
      default: false,
    },
  },
  subCommands: {
    create: () => import("./commands/create").then((r) => r.default),
    deploy: () => import("./commands/deploy").then((r) => r.default),
    push: () => import("./commands/push").then((r) => r.default),
    agents: () => import("./commands/agents").then((r) => r.default),
    secrets: () => import("./commands/secrets").then((r) => r.default),
    mcp: () => import("./commands/mcp").then((r) => r.default),
    generate: () => import("./commands/generate").then((r) => r.default),
    login: () => import("./commands/login").then((r) => r.default),
    logout: () => import("./commands/logout").then((r) => r.default),
    dev: () => import("./commands/dev").then((r) => r.default),
  },
  async run({ args }) {
    const firstArg = process.argv[2];

    if (args.help) {
      p.intro(`${LOGO} ${pc.bold("kalp")}`);
      printHelp();
      p.outro("Happy coding 🦋");
      return;
    }

    if (firstArg) {
      return;
    }

    p.intro(`${LOGO} ${pc.bold("kalp")}`);
    printHelp();
    p.outro("Happy coding 🦋");
  },
});

// Load .env if it exists in the current directory
async function bootstrap() {
  try {
    const { readDotEnv } = await import("./utils/ai");
    const cwd = process.cwd();
    const env = await readDotEnv(cwd);
    if (Object.keys(env).length > 0) {
      for (const [key, value] of Object.entries(env)) {
        if (!(key in process.env)) {
          process.env[key] = value;
        }
      }
    }
  } catch {
    // Ignore errors during bootstrap
  }
}

// Ensure bootstrap runs before runMain
bootstrap().then(() => {
  runMain(main);
});
