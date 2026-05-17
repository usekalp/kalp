export function resolveStudioAssetPath(pathname) {
  if (pathname === "/studio" || pathname === "/studio/") return "";
  const stripped = pathname.replace(/^\/studio\//, "");
  return stripped || "";
}

export function shouldTreatAsStaticAsset(assetPath) {
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

async function proxyStudioDevAsset(env, request) {
  const devOrigin = env.KALP_STUDIO_DEV_ORIGIN;
  if (!devOrigin) return null;
  const requestUrl = new URL(request.url);
  const targetUrl = new URL(requestUrl.pathname + requestUrl.search, devOrigin);
  return fetch(new Request(targetUrl.toString(), request));
}

async function serveBundledAsset(env, assetPath, request) {
  const assetUrl = new URL(request.url);
  assetUrl.hostname = "assets.local";
  assetUrl.pathname = assetPath ? `/${assetPath.replace(/^\/+/, "")}` : "/";
  return env.ASSETS.fetch(new Request(assetUrl.toString(), request));
}

export async function serveStudioRequest(env, request) {
  const devResponse = await proxyStudioDevAsset(env, request);
  if (devResponse) return devResponse;

  const pathname = new URL(request.url).pathname;
  const assetPath = resolveStudioAssetPath(pathname);
  if (!shouldTreatAsStaticAsset(assetPath)) {
    return serveBundledAsset(env, "", request);
  }

  const assetResponse = await serveBundledAsset(env, assetPath, request);
  if (assetResponse.status !== 404) return assetResponse;
  return serveBundledAsset(env, "", request);
}
