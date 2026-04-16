import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import pc from "picocolors";

const LOGO = "🦋";

export default defineCommand({
  meta: { name: "logout", description: "Sign out from Kalp" },
  async run() {
    p.intro(`${LOGO} ${pc.bold("kalp logout")}`);
    p.note(
      [
        "This command will clear your local Kalp credentials.",
        "",
        pc.dim("Coming soon..."),
      ].join("\n"),
      "Logout",
    );
    p.outro(pc.dim("No credentials stored."));
  },
});
