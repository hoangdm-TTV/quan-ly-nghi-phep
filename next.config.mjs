/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // 1. Cho phép Dev Server nhận request từ mạng ngoài / Dev Tunnel (Next.js 14.2+)
  allowedDevOrigins: ["*.devtunnels.ms", "l4dgp5bs-3000.asse.devtunnels.ms"],

  // 2. Tách riêng thư mục build dev và prod để tránh xung đột cache
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",

  // 3. Cấu hình cho Server Actions
  experimental: {
    serverActions: {
      bodySizeLimit: "6mb",
      // BẮT BUỘC: Cho phép Server Actions chấp nhận request từ Dev Tunnel & Localhost
      allowedOrigins: [
        "*.devtunnels.ms",
        "l4dgp5bs-3000.asse.devtunnels.ms",
        "localhost:3000",
      ],
    },
  },
};

export default nextConfig;
