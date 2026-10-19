import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the project root so a stray lockfile higher up the disk isn't picked up.
  turbopack: { root: path.join(__dirname) },
  // The Postgres driver loads from node_modules at runtime instead of being bundled.
  serverExternalPackages: ["pg"],
};

export default nextConfig;
