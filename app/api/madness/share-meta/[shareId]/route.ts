import { prisma } from '@/lib/prisma';

export async function GET(req: Request, { params }: { params: { shareId: string } }) {
  const share = await prisma.marchMadnessShare.findUnique({
    where: { id: params.shareId },
    include: {
      bracket: {
        include: {
          league: true,
          user: true,
        },
      },
    },
  });

  if (!share || !share.bracket) {
    return new Response('Not found', { status: 404 });
  }

  const { bracket, imageUrl } = share;
  const leagueName = bracket.league.name;
  const bracketName = bracket.name;
  const userName = bracket.user.displayName || bracket.user.username;

  const title = `${bracketName} in ${leagueName} | AF Madness`;
  const description = `Check out ${userName}'s March Madness bracket — powered by AI insights and live scoring. Join the league!`;
  const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://allfantasy.ai';
  const url = `${baseUrl}/madness/share/${share.id}`;
  const ogImage = `${baseUrl}/api/madness/og/${share.id}`;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${escapeHtml(title)}</title>

        <!-- Open Graph / Facebook -->
        <meta property="og:type" content="website" />
        <meta property="og:url" content="${escapeHtml(url)}" />
        <meta property="og:title" content="${escapeHtml(title)}" />
        <meta property="og:description" content="${escapeHtml(description)}" />
        <meta property="og:image" content="${escapeHtml(ogImage)}" />

        <!-- Twitter / X -->
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content="${escapeHtml(url)}" />
        <meta name="twitter:title" content="${escapeHtml(title)}" />
        <meta name="twitter:description" content="${escapeHtml(description)}" />
        <meta name="twitter:image" content="${escapeHtml(ogImage)}" />

        <!-- Redirect to actual bracket page -->
        <meta http-equiv="refresh" content="0; url=/madness/brackets/${bracket.id}" />
      </head>
      <body>
        <p>Redirecting to bracket...</p>
      </body>
    </html>
  `;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html',
      'Cache-Control': 'no-cache',
    },
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
