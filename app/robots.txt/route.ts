export async function GET() {
  const robotsTxt = `User-agent: *
Allow: /
Disallow: /admin

Sitemap: https://allfantasy.ai/sitemap.xml`

  return new Response(robotsTxt, {
    headers: {
      'Content-Type': 'text/plain',
    },
  })
}
