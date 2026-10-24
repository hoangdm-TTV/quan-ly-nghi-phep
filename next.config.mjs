/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Không dùng chung output giữa next dev và next build; tránh lệch Webpack/HMR.
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
  experimental: {
    serverActions: {
      bodySizeLimit: '6mb',
    },
  },
};

export default nextConfig;
