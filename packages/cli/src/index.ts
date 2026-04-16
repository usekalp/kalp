import { defineCommand, runMain } from "citty";

const main = defineCommand({
  meta: {
    name: "kalp",
    version: "0.0.1",
    description: "🦋 Zero-config agent infrastructure",
  },
  subCommands: {
    init: () => import("./commands/init.js").then((r) => r.default),
    create: () => import("./commands/create.js").then((r) => r.default),
    build: () => import("./commands/build.js").then((r) => r.default),
  },
});

runMain(main);
