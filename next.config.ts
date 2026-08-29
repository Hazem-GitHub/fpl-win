import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  serverExternalPackages: ["highs"],
  // Phone / LAN access (http://192.168.x.x:3000) is a different origin than localhost.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.16.*.*"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "resources.premierleague.com",
      },
    ],
  },
};

export default nextConfig;
