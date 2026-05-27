import { cp, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

const studioDist = resolve(
  __dirname,
  "..",
  "..",
  "..",
  "apps",
  "studio",
  "dist",
);
const target = resolve(__dirname, "..", "dist", "runtime-template", "studio");

await mkdir(target, { recursive: true });
await cp(studioDist, target, { recursive: true, force: true });
