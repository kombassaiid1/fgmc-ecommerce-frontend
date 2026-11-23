import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

/**
 * Hosts allowed to go through the image optimizer: the backend, the media storage and NEXT_PUBLIC_IMAGE_HOSTS.
 * Same list as lib/image-hosts.ts (that one decides, per image, whether to use the optimizer at all).
 */
function imageRemotePatterns(): NonNullable<NonNullable<NextConfig["images"]>["remotePatterns"]> {
  const urls = [
    "https://supabase.cliniquemachineacoudre.fr",
    process.env.NEXT_PUBLIC_BACKEND_API_URL,
    process.env.NEXT_PUBLIC_API_URL,
    ...(process.env.NEXT_PUBLIC_IMAGE_HOSTS ?? "").split(","),
  ];
  const seen = new Set<string>();
  const patterns: NonNullable<NonNullable<NextConfig["images"]>["remotePatterns"]> = [];
  for (const raw of urls) {
    const value = raw?.trim();
    if (!value) continue;
    try {
      const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
      const local = url.hostname === "localhost" || /^\d{1,3}(\.\d{1,3}){3}$/.test(url.hostname);
      if (local || url.protocol !== "https:" || seen.has(url.hostname)) continue;
      seen.add(url.hostname);
      patterns.push({ protocol: "https", hostname: url.hostname, pathname: "/**" });
    } catch {
      // ignore a malformed value
    }
  }
  return patterns;
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: imageRemotePatterns(),
    formats: ["image/avif", "image/webp"],
  },
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
