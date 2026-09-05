import type { NextConfig } from "next";

// STATIC_EXPORT=1 npm run build produces a fully static site in ./out
// (publishable to any static host). ISR and the Next image optimizer don't
// exist in that mode, so revalidate/unoptimized are switched off accordingly.
const staticExport = process.env.STATIC_EXPORT === "1";

const nextConfig: NextConfig = {
  ...(staticExport ? { output: "export" as const } : {}),
  images: {
    ...(staticExport ? { unoptimized: true } : {}),
    remotePatterns: [
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
  },
};

export default nextConfig;
