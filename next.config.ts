import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  experimental: {
    // Le premier tour du modèle peut dépasser 30 s : le proxy ne doit pas couper le flux NDJSON.
    proxyTimeout: 300_000,
  },
  turbopack: {
    // The frontend is nested in a workspace directory; process.cwd() can point
    // at that parent and make CSS package resolution miss this app's node_modules.
    root: projectRoot,
  },
  async rewrites() {
    return [
      // Le proxy Dokploy réserve /api à NestJS; ces URLs gardent les handlers Next accessibles.
      {
        source: "/frontend-api/:path*",
        destination: "/api/:path*",
      },
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
