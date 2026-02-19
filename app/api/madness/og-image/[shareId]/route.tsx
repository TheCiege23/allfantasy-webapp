import { ImageResponse } from 'next/og';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(req: Request, { params }: { params: { shareId: string } }) {
  const share = await prisma.marchMadnessShare.findUnique({
    where: { id: params.shareId },
    include: { bracket: { include: { league: true, user: true } } },
  });

  if (!share || !share.bracket) {
    return new Response('Not found', { status: 404 });
  }

  const { bracket } = share;
  const username = bracket.user.displayName || bracket.user.username || 'AF User';
  const title = `${bracket.name}`;
  const league = bracket.league.name;
  const desc = `Bracket by ${username}`;

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(to bottom right, #0a0a0f, #0f0f1a, #1a0a2e)',
          color: 'white',
          fontFamily: 'sans-serif',
          padding: '60px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '40px',
          }}
        >
          <div
            style={{
              fontSize: 72,
              fontWeight: 800,
              letterSpacing: '-2px',
              background: 'linear-gradient(to right, #22d3ee, #a855f7, #c026d3)',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            AF Madness
          </div>
        </div>

        <div
          style={{
            fontSize: 48,
            fontWeight: 700,
            marginBottom: '16px',
            textAlign: 'center',
            maxWidth: '900px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap' as const,
          }}
        >
          {title}
        </div>

        <div
          style={{
            fontSize: 32,
            color: '#22d3ee',
            marginBottom: '12px',
          }}
        >
          {league}
        </div>

        <div
          style={{
            fontSize: 28,
            color: 'rgba(255,255,255,0.7)',
            marginBottom: '40px',
          }}
        >
          {desc}
        </div>

        <div
          style={{
            display: 'flex',
            gap: '24px',
            marginTop: '20px',
          }}
        >
          {['Round 1', 'Round 2', 'Sweet 16', 'Elite 8', 'Final 4', 'Championship'].map(
            (round) => (
              <div
                key={round}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '16px 20px',
                  borderRadius: '12px',
                  background: 'rgba(34, 211, 238, 0.1)',
                  border: '1px solid rgba(34, 211, 238, 0.2)',
                }}
              >
                <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>{round}</span>
              </div>
            ),
          )}
        </div>

        <div
          style={{
            position: 'absolute',
            bottom: '30px',
            fontSize: 18,
            color: 'rgba(255,255,255,0.4)',
          }}
        >
          Powered by AllFantasy AI
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
