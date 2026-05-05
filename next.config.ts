import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Go 백엔드가 정적 산출물(`out/`)을 함께 서빙하므로 정적 export.
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
