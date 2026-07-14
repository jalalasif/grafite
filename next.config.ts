import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Body-size headroom for pasted-image / import uploads handled in the route
  // handlers themselves; keep the framework config minimal (§I.1).
};

export default nextConfig;
