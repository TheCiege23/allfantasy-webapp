import { describe, it, expect, vi, beforeEach } from 'vitest'
import { computeDualModeTradeDelta, UserTrade } from '@/lib/hybrid-valuation'

vi.mock('@/lib/fantasycalc', () => ({
  fetchFantasyCalcValues: vi.fn().mockResolvedValue([
    { player: { name: 'Tyreek Hill' }, value: 7500, overallRank: 15, trend30Day: -200 },
    { player: { name: 'Joe Flacco' }, value: 800, overallRank: 120, trend30Day: 50 },
    { player: { name: 'CeeDee Lamb' }, value: 9000, overallRank: 5, trend30Day: 100 },
    { player: { name: 'Chris Olave' }, value: 5500, overallRank: 25, trend30Day: -50 },
    { player: { name: 'Jaylen Waddle' }, value: 6000, overallRank: 20, trend30Day: 0 },
  ]),
  findPlayerByName: vi.fn().mockImplementation((players: any[], name: string) => {
    return players.find((p: any) => p.player.name.toLowerCase() === name.toLowerCase())
  }),
}))

describe('Historical Trade Valuation - Hybrid Engine', () => {
  describe('Tyreek Hill ↔ Joe Flacco (2025)', () => {
    const trade: UserTrade = {
      transactionId: 'test-tyreek-flacco-2025',
      timestamp: new Date('2025-09-14').getTime(),
      parties: [
        {
          userId: 'USER_A',
          teamName: 'TheCiege24',
          playersReceived: [{ name: 'Joe Flacco', position: 'QB' }],
          picksReceived: [{ round: 3, season: '2026', slot: undefined }],
        },
        {
          userId: 'USER_B',
          teamName: 'DynastyKing',
          playersReceived: [{ name: 'Tyreek Hill', position: 'WR' }],
          picksReceived: [],
        },
      ],
    }

    it('prices trade correctly AT THE TIME', async () => {
      const result = await computeDualModeTradeDelta(trade, 'USER_A', true)

      expect(result.atTheTime).toBeDefined()
      expect(result.atTheTime).not.toBeNull()
      
      if (result.atTheTime) {
        expect(result.atTheTime.userReceivedValue).toBeGreaterThan(0)
        expect(result.atTheTime.userGaveValue).toBeGreaterThan(0)
        expect(typeof result.atTheTime.deltaValue).toBe('number')
        expect(result.atTheTime.grade).toBeDefined()
        expect(['F', 'D-']).not.toContain(result.atTheTime.grade)
        
        const allAssets = [...result.atTheTime.receivedAssets, ...result.atTheTime.gaveAssets]
        expect(allAssets.length).toBeGreaterThan(0)
        const hasValidSource = allAssets.every(a => 
          ['excel', 'fantasycalc', 'curve', 'unknown'].includes(a.source)
        )
        expect(hasValidSource).toBe(true)
      }
    })

    it('shows different result with hindsight', async () => {
      const result = await computeDualModeTradeDelta(trade, 'USER_A', true)

      expect(result.withHindsight).toBeDefined()
      expect(result.atTheTime).toBeDefined()
      
      if (result.atTheTime && result.withHindsight) {
        expect(result.withHindsight.deltaValue).not.toBe(result.atTheTime.deltaValue)
      }
    })

    it('provides comparison text', async () => {
      const result = await computeDualModeTradeDelta(trade, 'USER_A', true)
      expect(result.comparison).toBeDefined()
      expect(result.comparison.length).toBeGreaterThan(0)
    })
  })

  describe('Pick-only trade (2025 1st ↔ 2026 2nd + 3rd)', () => {
    const pickTrade: UserTrade = {
      transactionId: 'test-pick-trade-2025',
      timestamp: new Date('2025-03-15').getTime(),
      parties: [
        {
          userId: 'PICK_TRADER_A',
          teamName: 'PickMaster',
          playersReceived: [],
          picksReceived: [
            { round: 2, season: '2026', slot: 'mid' },
            { round: 3, season: '2026', slot: 'early' },
          ],
        },
        {
          userId: 'PICK_TRADER_B',
          teamName: 'FutureBuilder',
          playersReceived: [],
          picksReceived: [{ round: 1, season: '2025', slot: 'late' }],
        },
      ],
    }

    it('values picks using Excel or curve sources', async () => {
      const result = await computeDualModeTradeDelta(pickTrade, 'PICK_TRADER_A', true)

      expect(result.atTheTime).toBeDefined()
      if (result.atTheTime) {
        const allAssets = [...result.atTheTime.receivedAssets, ...result.atTheTime.gaveAssets]
        const validSources = allAssets.every(a => 
          a.source === 'excel' || a.source === 'curve'
        )
        expect(validSources).toBe(true)
      }
    })

    it('includes valuation stats for picks', async () => {
      const result = await computeDualModeTradeDelta(pickTrade, 'PICK_TRADER_A', true)

      expect(result.atTheTime).toBeDefined()
      if (result.atTheTime) {
        const stats = result.atTheTime.valuationStats
        const totalPicks = stats.picksFromExcel + stats.picksFromCurve
        expect(totalPicks).toBeGreaterThan(0)
      }
    })
  })

  describe('Source tracking and confidence', () => {
    const mixedTrade: UserTrade = {
      transactionId: 'test-mixed-trade',
      timestamp: new Date('2024-06-01').getTime(),
      parties: [
        {
          userId: 'MANAGER_A',
          teamName: 'TeamAlpha',
          playersReceived: [{ name: 'CeeDee Lamb', position: 'WR' }],
          picksReceived: [],
        },
        {
          userId: 'MANAGER_B',
          teamName: 'TeamBeta',
          playersReceived: [
            { name: 'Chris Olave', position: 'WR' },
            { name: 'Jaylen Waddle', position: 'WR' },
          ],
          picksReceived: [{ round: 2, season: '2025', slot: 'mid' }],
        },
      ],
    }

    it('tracks valuation sources accurately', async () => {
      const result = await computeDualModeTradeDelta(mixedTrade, 'MANAGER_A', true)

      expect(result.atTheTime).toBeDefined()
      if (result.atTheTime) {
        const stats = result.atTheTime.valuationStats
        const totalPlayers = stats.playersFromExcel + stats.playersFromFantasyCalc + stats.playersUnknown
        expect(totalPlayers).toBe(3)
      }
    })

    it('computes confidence between 0.15 and 0.95', async () => {
      const result = await computeDualModeTradeDelta(mixedTrade, 'MANAGER_A', true)

      expect(result.atTheTime).toBeDefined()
      if (result.atTheTime) {
        expect(result.atTheTime.confidence).toBeGreaterThanOrEqual(0.15)
        expect(result.atTheTime.confidence).toBeLessThanOrEqual(0.95)
      }
    })
  })
})
