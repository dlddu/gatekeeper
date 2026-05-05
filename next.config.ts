import type { NextConfig } from "next";

// Go 백엔드 위치 — 빌드 시 GO_BACKEND_URL로 오버라이드 가능.
const apiTarget = process.env.GO_BACKEND_URL ?? "http://127.0.0.1:3000";

const nextConfig: NextConfig = {
  output: "standalone",
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Service-Worker-Allowed",
            value: "/",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiTarget}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
