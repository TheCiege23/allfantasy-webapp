import { withApiUsage } from "@/lib/telemetry/usage"
import { NextResponse } from 'next/server';
import { getAllPlayers } from '@/lib/sleeper-client';
import { ensureNumber } from '@/lib/engine/response-guard';

export const GET = withApiUsage({ endpoint: "/api/legacy/players", tool: "LegacyPlayers" })(async () => {
  try {
    const players = await getAllPlayers();
    
    const simplified: Record<string, { name: string; position: string; team: string | null }> = {};
    
    for (const [id, player] of Object.entries(players)) {
      if (player && typeof player === 'object') {
        simplified[id] = {
          name: player.full_name || `${player.first_name || ''} ${player.last_name || ''}`.trim() || id,
          position: player.position || '',
          team: player.team || null,
        };
      }
    }
    
    return NextResponse.json({
      players: simplified,
      total: ensureNumber(Object.keys(simplified).length),
    });
  } catch (error) {
    console.error('Failed to fetch players:', error);
    return NextResponse.json({ players: {}, total: 0 });
  }
})
