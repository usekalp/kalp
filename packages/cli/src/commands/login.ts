import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

const LOGO = "🦋";

export default defineCommand({
  meta: { name: "login", description: "Authenticate with Kalp" },
  async run() {
    const home = homedir();

    p.intro(`${LOGO} ${pc.bold("kalp login")}`);

    const s = p.spinner();
    s.start("Authenticating...");

    // Create ~/.kalp directory (global user config)
    const kalpDir = join(home, ".kalp");
    await mkdir(kalpDir, { recursive: true });

    // Create mock auth.json
    const authData = {
      token: "mock-token-" + Date.now(),
      email: "user@example.com",
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };

    await writeFile(
      join(kalpDir, "auth.json"),
      JSON.stringify(authData, null, 2),
      "utf-8",
    );

    s.stop("Authenticated successfully");
    p.log.success(`Logged in as ${pc.cyan(authData.email)}`);
    p.outro(pc.green("Ready to use Kalp Cloud"));
  },
});
