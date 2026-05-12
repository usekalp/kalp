import {
  access,
  cp,
  mkdir,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CLI_DIR = resolve(__dirname, "..");
const REPO_ROOT = resolve(CLI_DIR, "..", "..");
const STUDIO_DIST_ROOT = resolve(REPO_ROOT, "apps", "studio", "dist");
const STUDIO_DIST_CLIENT = resolve(STUDIO_DIST_ROOT, "client");
const TEMPLATE_SOURCE_DIR = resolve(CLI_DIR, "runtime-template");
const DIST_RUNTIME_TEMPLATE_DIR = resolve(CLI_DIR, "dist", "runtime-template");
const DIST_STUDIO_DIR = join(DIST_RUNTIME_TEMPLATE_DIR, "studio");

function createStudioShell(entryScript, cssFiles, rootId = "root") {
  const cssLinks = cssFiles
    .map((file) => `    <link rel="stylesheet" href="/studio/assets/${file}" />`)
    .join("\n");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Kalp Studio</title>
${cssLinks}
  </head>
  <body>
    <div id="${rootId}"></div>
    <script type="module" src="/studio/assets/${entryScript}"></script>
  </body>
</html>
`;
}

async function ensureStudioIndex(studioDir, rootId = "root") {
  const indexPath = join(studioDir, "index.html");

  try {
    await access(indexPath);
    return;
  } catch {
    // generate fallback index
  }

  const assetsDir = join(studioDir, "assets");
  const assetFiles = await readdir(assetsDir);
  const entryScript =
    assetFiles.find((file) => /^index-.*\.js$/i.test(file)) ??
    assetFiles.find((file) => file.endsWith(".js"));

  if (!entryScript) {
    throw new Error(
      "Could not find Studio entry bundle (index-*.js) in apps/studio/dist/client/assets.",
    );
  }

  const cssFiles = assetFiles.filter((file) => file.endsWith(".css")).sort();
  await writeFile(indexPath, createStudioShell(entryScript, cssFiles, rootId), "utf-8");
}

async function prepareRuntimeTemplate() {
  let studioDistDir = STUDIO_DIST_ROOT;
  const hasDistRoot = await access(STUDIO_DIST_ROOT).then(
    () => true,
    () => false,
  );
  const hasDistClient = await access(STUDIO_DIST_CLIENT).then(
    () => true,
    () => false,
  );

  if (!hasDistRoot && !hasDistClient) {
    throw new Error(
      "Missing apps/studio/dist. Run `pnpm --filter=@kalphq/studio build` first.",
    );
  }

  let rootElementId = "app";
  if (hasDistClient) {
    const hasRootIndex = await access(join(STUDIO_DIST_ROOT, "index.html")).then(
      () => true,
      () => false,
    );
    if (!hasRootIndex) {
      studioDistDir = STUDIO_DIST_CLIENT;
      rootElementId = "root";
    }
  }

  await rm(DIST_RUNTIME_TEMPLATE_DIR, { recursive: true, force: true });
  await mkdir(DIST_RUNTIME_TEMPLATE_DIR, { recursive: true });
  await cp(studioDistDir, DIST_STUDIO_DIR, { recursive: true });
  await cp(
    join(TEMPLATE_SOURCE_DIR, "worker-entry.js"),
    join(DIST_RUNTIME_TEMPLATE_DIR, "worker-entry.js"),
  );
  await ensureStudioIndex(DIST_STUDIO_DIR, rootElementId);
}

prepareRuntimeTemplate().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
