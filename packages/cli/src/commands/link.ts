import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import pc from "picocolors";

const LOGO = "🦋";

export default defineCommand({
  meta: { name: "link", description: "Link project to Kalp cloud" },
  async run() {
    p.intro(`${LOGO} ${pc.bold("kalp link")}`);
    p.note(
      ["This command will link your local project to the Kalp cloud.", "", pc.dim("Coming soon...")].join("\n"),
      "Link",
    );
    p.outro(pc.dim("Run kalp login first to authenticate."));
  },
});
