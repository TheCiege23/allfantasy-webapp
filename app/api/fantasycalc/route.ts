import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from 'next/server';
import { 
  fetchFantasyCalcValues, 
  findPlayerByName,
  compareTradeValues,
  getTopPlayers,
  getTrendingPlayers,
  FantasyCalcSettings
} from '@/lib/fantasycalc';

export const GET = withApiUsage({ endpoint: "/api/fantasycalc", tool: "Fantasycalc" })(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    
    const isDynasty = searchParams.get('isDynasty') !== 'false';
    const numQbs = searchParams.get('numQbs') === '2' ? 2 : 1;
    const numTeams = parseInt(searchParams.get('numTeams') || '12');
    const ppr = parseFloat(searchParams.get('ppr') || '1') as 0 | 0.5 | 1;
    
    const action = searchParams.get('action') || 'values';
    const playerName = searchParams.get('player');
    const position = searchParams.get('position');
    const limit = parseInt(searchParams.get('limit') || '50');
    
    const settings: FantasyCalcSettings = { isDynasty, numQbs, numTeams, ppr };
    
    const players = await fetchFantasyCalcValues(settings);
    
    if (action === 'player' && playerName) {
      const player = findPlayerByName(players, playerName);
      if (!player) {
        return NextResponse.json({ error: 'Player not found' }, { status: 404 });
      }
      return NextResponse.json({ player, settings });
    }
    
    if (action === 'top') {
      const topPlayers = getTopPlayers(players, position || undefined, limit);
      return NextResponse.json({ players: topPlayers, settings });
    }
    
    if (action === 'trending') {
      const direction = searchParams.get('direction') === 'down' ? 'down' : 'up';
      const trending = getTrendingPlayers(players, direction, limit);
      return NextResponse.json({ players: trending, direction, settings });
    }
    
    if (action === 'values') {
      const filtered = position 
        ? players.filter(p => p.player.position.toUpperCase() === position.toUpperCase())
        : players;
      return NextResponse.json({ players: filtered.slice(0, limit), total: filtered.length, settings });
    }
    
    return NextResponse.json({ players: players.slice(0, limit), total: players.length, settings });
    
  } catch (error) {
    console.error('FantasyCalc API error:', error);
    return NextResponse.json({ error: 'Failed to fetch FantasyCalc data' }, { status: 500 });
  }
})

export const POST = withApiUsage({ endpoint: "/api/fantasycalc", tool: "Fantasycalc" })(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { sideA, sideB, isDynasty = true, numQbs = 2, numTeams = 12, ppr = 1 } = body;
    
    if (!sideA || !sideB || !Array.isArray(sideA) || !Array.isArray(sideB)) {
      return NextResponse.json({ error: 'sideA and sideB arrays are required' }, { status: 400 });
    }
    
    const settings: FantasyCalcSettings = { 
      isDynasty, 
      numQbs: numQbs === 2 ? 2 : 1, 
      numTeams, 
      ppr 
    };
    
    const players = await fetchFantasyCalcValues(settings);
    const comparison = compareTradeValues(players, sideA, sideB);
    
    return NextResponse.json({ 
      ...comparison, 
      settings,
      source: 'FantasyCalc.com',
      note: 'Values based on ~1 million real fantasy football trades'
    });
    
  } catch (error) {
    console.error('FantasyCalc trade compare error:', error);
    return NextResponse.json({ error: 'Failed to compare trade values' }, { status: 500 });
  }
})
