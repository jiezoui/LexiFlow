import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/login",
        destination: "/sign-in",
        permanent: true,
      },
      {
        source: "/register",
        destination: "/sign-up",
        permanent: true,
      },
    ]
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:8080/api/:path*",
      },
    ]
  },
};

export default nextConfig;
