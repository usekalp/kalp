import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import pc from "picocolors";

const LOGO = "🦋";

export default defineCommand({
  meta: {
    name: "secrets",
    description: "Manage remote runtime secrets",
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
    list: () => import("./list").then((r) => r.default),
    add: () => import("./add").then((r) => r.default),
    delete: () => import("./delete").then((r) => r.default),
    sync: () => import("./sync").then((r) => r.default),
  },
  run({ args }) {
    if (!args.help) {
      return;
    }

    p.intro(`${LOGO} ${pc.bold("kalp secrets")}`);
    p.log.message(pc.bold("Available subcommands:"));
    p.log.message(`  ${pc.cyan("list")}   List secrets from remote runtime`);
    p.log.message(`  ${pc.cyan("add")}    Add a secret to remote runtime`);
    p.log.message(`  ${pc.cyan("delete")} Delete a secret from remote runtime`);
    p.log.message(
      `  ${pc.cyan("sync")}   Merge remote secrets into local config`,
    );
    p.log.message("");
    p.log.message(
      `Run ${pc.cyan("kalp secrets <subcommand> --help")} for more info.`,
    );
    p.outro(pc.dim("Done"));
  },
});
