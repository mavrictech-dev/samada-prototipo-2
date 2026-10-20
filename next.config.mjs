/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  serverExternalPackages: ['pg', 'pg-boss', 'sharp', 'nodemailer'],
};

export default nextConfig;
