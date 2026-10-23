/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.torob.com',
      },
      {
        protocol: 'http',
        hostname: '**.torob.com',
      },
      {
        protocol: 'https',
        hostname: 'image.torob.com',
      }
    ],
  },
};

export default nextConfig;
