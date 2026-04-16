import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import pc from "picocolors";

const LOGO = "🦋";

export default defineCommand({
  meta: { name: "login", description: "Authenticate with Kalp" },
  async run() {
    p.intro(`${LOGO} ${pc.bold("kalp login")}`);
    p.note(
      [
        "This command will open a browser to authenticate with Kalp.",
        "",
        pc.dim("Coming soon..."),
      ].join("\n"),
      "Login",
    );
    p.outro(pc.dim("Authentication flow not yet implemented."));
  },
});
