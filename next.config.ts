import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [{ source: "/hospital", destination: "/hospital/local", permanent: false }];
  },
};

export default nextConfig;
