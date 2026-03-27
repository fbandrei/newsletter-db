import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /* Image optimization for Vercel */
  images: {
    unoptimized: false,
  },
  /* Ensure external packages are bundled correctly for different runtimes */
  serverExternalPackages: [
    "@prisma/client",
    "@prisma/adapter-pg",
    "bullmq",
    "ioredis",
  ],
};

export default nextConfig;
