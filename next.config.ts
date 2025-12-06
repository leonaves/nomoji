import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  basePath: '/games/day-6',
  assetPrefix: '/games/day-6',
};

export default nextConfig;
