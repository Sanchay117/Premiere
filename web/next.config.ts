import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // No Next.js badge in the corner during development; build errors still show in their overlay.
  devIndicators: false,
};

export default nextConfig;
