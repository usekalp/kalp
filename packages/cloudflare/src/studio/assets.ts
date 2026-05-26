export function resolveStudioAssetPath(pathname: string): string {
  if (pathname === "/studio" || pathname === "/studio/") return "";
  const stripped = pathname.replace(/^\/studio\//, "");
  return stripped || "";
}

export async function serveAsset(
  env: { ASSETS: Fetcher },
  assetPath: string,
  request: Request,
): Promise<Response> {
  const assetUrl = new URL(request.url);
  assetUrl.hostname = "assets.local";
  assetUrl.pathname = assetPath ? `/${assetPath.replace(/^\/+/, "")}` : "/";
  return env.ASSETS.fetch(new Request(assetUrl.toString(), request));
}

export function shouldTreatAsStaticAsset(assetPath: string): boolean {
  if (!assetPath) return false;
  if (assetPath.startsWith("assets/")) return true;
  if (assetPath.startsWith("@vite/")) return true;
  if (assetPath.startsWith("src/")) return true;
  if (assetPath.startsWith("node_modules/")) return true;
  if (assetPath === "favicon.ico") return true;
  if (assetPath === "manifest.json") return true;
  if (assetPath === "robots.txt") return true;
  return assetPath.includes(".");
}