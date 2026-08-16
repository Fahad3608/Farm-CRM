import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Photos are posted through server actions as data URLs, so the default
  // 1 MB action body limit is too small for a camera photo.
  experimental: { serverActions: { bodySizeLimit: "8mb" } },
};

export default nextConfig;
