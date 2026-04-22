import { defineCommand, runMain } from "citty";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pkg = require("../package.json");

const LOGO = "🦋";

const COMMANDS = [
  ["create", "Add a new agent"],
  ["push", "Push agent to Kalp"],
  ["link", "Link project to Kalp cloud"],
  ["secrets", "Manage secrets"],
  ["login", "Authenticate with Kalp"],
  ["logout", "Sign out from Kalp"],
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
    push: () => import("./commands/push").then((r) => r.default),
    link: () => import("./commands/link").then((r) => r.default),
    secrets: () => import("./commands/secrets").then((r) => r.default),
    login: () => import("./commands/login").then((r) => r.default),
    logout: () => import("./commands/logout").then((r) => r.default),
  },
  run({ args }) {
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

runMain(main);
