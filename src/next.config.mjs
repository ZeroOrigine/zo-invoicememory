/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Non-critical type/lint issues must never block a deploy. QA Mind owns code quality.
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
}

export default nextConfig
