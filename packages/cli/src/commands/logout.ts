import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { getGlobalConfigDir } from "@/utils/config";

const LOGO = "🦋";

export default defineCommand({
  meta: { name: "logout", description: "Sign out from Kalp" },
  async run() {
    p.intro(`${LOGO} ${pc.bold("kalp logout")}`);

    const s = p.spinner();
    s.start("Signing out...");

    try {
      await rm(join(getGlobalConfigDir(), "auth.json"), { force: true });
      s.stop("Signed out successfully");
      p.outro(pc.green("Logged out from Kalp"));
    } catch {
      s.stop("Nothing to do");
      p.outro(pc.dim("No active session found"));
    }
  },
});
