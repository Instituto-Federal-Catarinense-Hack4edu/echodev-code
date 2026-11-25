import type { NextConfig } from "next";

// Optional: serve the Python API under /py on the same address (one public URL, one tunnel).
const apiProxyTarget = process.env.API_PROXY_TARGET?.replace(/\/$/, "");

const nextConfig: NextConfig = {
  // Dev only: extra hosts allowed to load dev assets (127.0.0.1 for a 2nd session in tests,
  // plus e.g. DEV_ORIGINS=192.168.0.10 to open the app from a phone on the LAN).
  allowedDevOrigins: ["127.0.0.1", ...(process.env.DEV_ORIGINS?.split(",").filter(Boolean) ?? [])],
  cacheComponents: true,
  // Ending a long lesson waits for the AI summary through the /py proxy.
  experimental: { proxyTimeout: 300_000 },
  async rewrites() {
    return apiProxyTarget ? [{ source: "/py/:path*", destination: `${apiProxyTarget}/:path*` }] : [];
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
