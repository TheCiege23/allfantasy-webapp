/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'sleepercdn.com' },
      { protocol: 'https', hostname: 'a.espncdn.com' },
    ],
  },
  allowedDevOrigins: [
    'http://127.0.0.1:5000',
    'http://127.0.0.1',
    'http://localhost:5000',
    'http://localhost',
    'https://*.replit.dev',
    'https://*.janeway.replit.dev',
    'https://*.replit.app',
    'https://*.repl.co',
    `https://${process.env.REPLIT_DEV_DOMAIN || ''}`,
  ],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
