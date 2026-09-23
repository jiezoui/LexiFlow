import type { NextConfig } from "next";

const apiBase = (process.env.LEXIFLOW_API_BASE || "http://127.0.0.1:8080").replace(/\/$/, "")

const nextConfig: NextConfig = {
  // Next.js 16 默认只允许 `localhost` 访问开发资源（HMR、客户端 chunk 等），
  // 从 `127.0.0.1` 打开页面时这些请求会被判定为跨源并**静默拦截**，
  // 表现为「服务端 HTML 能渲染，但客户端组件完全不 hydrate」——
  // 页面上所有按钮都失灵、useEffect 不执行，且控制台只有一行警告。
  // 本机部署同时使用 localhost 与 127.0.0.1（脚本/无头浏览器走 127.0.0.1），
  // 因此两者都显式放行。
  allowedDevOrigins: ["localhost", "127.0.0.1", "[::1]"],
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
        source: "/api/:path((?!speech(?:/|$)).*)",
        destination: `${apiBase}/api/:path*`,
      },
    ]
  },
};

export default nextConfig;
