import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@kalphq/compiler", "esbuild"],
};

export default nextConfig;
