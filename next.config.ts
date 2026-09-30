import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    // The frontend is nested in a workspace directory; process.cwd() can point
    // at that parent and make CSS package resolution miss this app's node_modules.
    root: projectRoot,
  },
  async rewrites() {
    return [
      // Keep legacy ".html" product URLs but serve the normal route.
      {
        source: "/:slug/:productSlug.html",
        destination: "/:slug/:productSlug",
      },
    ];
  },
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
