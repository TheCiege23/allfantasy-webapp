import { prisma } from '@/lib/prisma'
import type { ADPEntry } from '@/lib/adp-data'

type AdpAdjustment = {
  name: string
  adjustedAdp: number
  delta: number
  reasons: string[]
}

function normalizeName(name: string) {
  return String(name || '')
    .toLowerCase()
    .replace(/[.'-]/g, '')
    .replace(/\s+(jr|sr|ii|iii|iv|v)$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

async function fetchRecentSportsSignals() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const dbNews = await prisma.sportsNews.findMany({
    where: {
      sport: 'NFL',
      OR: [
        { publishedAt: { gte: sevenDaysAgo } },
        { createdAt: { gte: sevenDaysAgo } },
      ],
    },
    orderBy: { publishedAt: 'desc' },
    take: 150,
    select: { playerName: true, title: true, content: true, source: true },
  }).catch(() => [])

  const espnNews: Array<{ playerName?: string | null; title: string; content?: string | null; source: string }> = []
  try {
    const res = await fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/news?limit=40', {
      cache: 'no-store',
      signal: AbortSignal.timeout(4000),
    })
    if (res.ok) {
      const json = await res.json()
      const articles = Array.isArray(json?.articles) ? json.articles : []
      for (const a of articles) {
        const title = String(a?.headline || '')
        const content = String(a?.description || a?.story || '')
        espnNews.push({ playerName: null, title, content, source: 'espn_live' })
      }
    }
  } catch {
  }

  return [...dbNews, ...espnNews]
}

function computeNewsDelta(text: string): { delta: number; reasons: string[] } {
  const t = text.toLowerCase()
  let delta = 0
  const reasons: string[] = []

  if (/(out|ir|injured reserve|season-ending|torn|suspension)/.test(t)) {
    delta += 10
    reasons.push('Negative injury/availability signal')
  }
  if (/(questionable|doubtful|limited|setback)/.test(t)) {
    delta += 4
    reasons.push('Short-term risk signal')
  }
  if (/(promoted|starter|first team|extended|breakout|impressed|surging)/.test(t)) {
    delta -= 4
    reasons.push('Positive role/momentum signal')
  }
  if (/(traded|trade to)/.test(t)) {
    delta -= 2
    reasons.push('Recent trade/news volatility signal')
  }

  return { delta, reasons }
}

export async function applyRealtimeAdpAdjustments(entries: ADPEntry[], opts?: { isDynasty?: boolean }) {
  const news = await fetchRecentSportsSignals()
  const rookieRanks = await (prisma as any).rookieRanking.findMany({
    where: { year: { in: [new Date().getFullYear(), new Date().getFullYear() + 1] } },
    select: { name: true, rank: true },
    orderBy: { rank: 'asc' },
    take: 80,
  }).catch(() => [])

  const rookieRankMap = new Map<string, number>()
  for (const r of rookieRanks) rookieRankMap.set(normalizeName(r.name), Number(r.rank || 999))

  const newsByPlayer = new Map<string, { delta: number; reasons: string[] }>()

  for (const n of news) {
    const playerHint = n.playerName ? normalizeName(n.playerName) : ''
    const text = `${n.title || ''} ${n.content || ''}`
    const parsed = computeNewsDelta(text)

    if (playerHint) {
      const existing = newsByPlayer.get(playerHint) || { delta: 0, reasons: [] }
      existing.delta += parsed.delta
      existing.reasons.push(...parsed.reasons)
      newsByPlayer.set(playerHint, existing)
      continue
    }
  }

  const adjusted: ADPEntry[] = []
  const adjustments: AdpAdjustment[] = []

  for (const e of entries) {
    const key = normalizeName(e.name)
    let adpDelta = 0
    const reasons: string[] = []

    const fromNews = newsByPlayer.get(key)
    if (fromNews) {
      adpDelta += fromNews.delta
      reasons.push(...fromNews.reasons)
    }

    if (opts?.isDynasty) {
      const rk = rookieRankMap.get(key)
      if (rk != null) {
        if (rk <= 5) { adpDelta -= 9; reasons.push('Top rookie ranking boost') }
        else if (rk <= 12) { adpDelta -= 5; reasons.push('Strong rookie ranking boost') }
        else if (rk <= 24) { adpDelta -= 2; reasons.push('Rookie ranking support') }
      }
    }

    const adjustedAdp = clamp(Number(e.adp || 999) + adpDelta, 1, 999)
    adjusted.push({ ...e, adp: adjustedAdp })

    if (Math.abs(adpDelta) >= 2) {
      adjustments.push({
        name: e.name,
        adjustedAdp,
        delta: adpDelta,
        reasons: Array.from(new Set(reasons)).slice(0, 2),
      })
    }
  }

  adjusted.sort((a, b) => a.adp - b.adp)

  return {
    entries: adjusted,
    adjustments: adjustments.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 35),
    sourcesUsed: {
      rookieRanking: rookieRanks.length,
      sportsNews: news.length,
      espn: news.filter(n => n.source === 'espn_live').length,
    },
  }
}
