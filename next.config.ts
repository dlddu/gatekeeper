import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Go 백엔드가 정적 산출물(`out/`)을 함께 서빙하므로 정적 export.
  // trailingSlash 는 Default(false): 페이지/URL 모두 트레일링 슬래시 없이 동작.
  output: "export",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
