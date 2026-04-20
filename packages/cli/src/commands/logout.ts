import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

const LOGO = "🦋";

export default defineCommand({
  meta: { name: "logout", description: "Sign out from Kalp" },
  async run() {
    const home = homedir();

    p.intro(`${LOGO} ${pc.bold("kalp logout")}`);

    const s = p.spinner();
    s.start("Signing out...");

    try {
      await rm(join(home, ".kalp", "auth.json"), { force: true });
      s.stop("Signed out successfully");
      p.outro(pc.green("Logged out from Kalp"));
    } catch {
      s.stop("Nothing to do");
      p.outro(pc.dim("No active session found"));
    }
  },
});
