import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This app requires a Next.js runtime; a static export cannot provide the
  // cached backend endpoint used for live refreshes.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
  },
};

export default nextConfig;
