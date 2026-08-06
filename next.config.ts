import type { NextConfig } from "next";

/** Next.js runtime and prefetching configuration for Still. */
const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
