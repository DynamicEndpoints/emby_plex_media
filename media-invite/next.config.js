/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'img.clerk.com',
      },
    ],
  },
  // External packages that should not be bundled
  serverExternalPackages: ['nodemailer'],
  // Ignore TypeScript errors during build (for faster iteration)
  typescript: {
    ignoreBuildErrors: false,
  },
};

module.exports = nextConfig;
