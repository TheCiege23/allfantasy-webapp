/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    '/api/**': ['./data/**'],
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'sleepercdn.com' },
      { protocol: 'https', hostname: 'a.espncdn.com' },
    ],
  },
  allowedDevOrigins: [
    `https://${process.env.REPLIT_DEV_DOMAIN || '*.janeway.replit.dev'}`,
    'https://*.replit.dev',
    'https://*.replit.app',
    'http://127.0.0.1:5000',
    'http://localhost:5000',
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
