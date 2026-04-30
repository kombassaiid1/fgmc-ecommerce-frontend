import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // Keep legacy ".html" product URLs but serve the normal route.
      {
        source: "/:slug/:productSlug.html",
        destination: "/:slug/:productSlug",
      },
    ];
  },
};

export default nextConfig;
