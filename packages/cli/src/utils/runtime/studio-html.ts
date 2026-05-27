import { access, mkdir, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export const STUDIO_DIR = "studio";

function createStudioShell(entryScript: string, cssFiles: string[]): string {
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
    <div id="root"></div>
    <script type="module" src="/studio/assets/${entryScript}"></script>
  </body>
</html>
`;
}

export async function ensureStudioIndex(studioDir: string): Promise<void> {
  const indexPath = join(studioDir, "index.html");
  try {
    await access(indexPath);
    return;
  } catch {
    // index.html is missing on some TanStack Start static builds.
  }

  const assetsDir = join(studioDir, "assets");
  const assetFiles = await readdir(assetsDir);
  const entryScript =
    assetFiles.find((file) => /^index-.*\.js$/i.test(file)) ??
    assetFiles.find((file) => file.endsWith(".js"));

  if (!entryScript) {
    throw new Error(
      "Studio runtime template is missing an entry JS bundle in studio/assets.",
    );
  }

  const cssFiles = assetFiles.filter((file) => file.endsWith(".css")).sort();
  const html = createStudioShell(entryScript, cssFiles);
  await writeFile(indexPath, html, "utf-8");
}

export async function ensureLiveWorkspaceStudioPlaceholder(studioDir: string): Promise<void> {
  await mkdir(studioDir, { recursive: true });
  await writeFile(
    join(studioDir, "index.html"),
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Kalp Studio</title>
  </head>
  <body>
    <div id="root">Kalp Studio live workspace proxy is starting...</div>
  </body>
</html>
`,
    "utf-8",
  );
}
