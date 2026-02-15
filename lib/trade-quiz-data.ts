export type QuizTrade = {
  id: number
  scenario: string
  sideA: {
    label: string
    assets: string[]
  }
  sideB: {
    label: string
    assets: string[]
  }
  traits: {
    youthVsProduction: number
    consolidationVsDepth: number
    picksVsPlayers: number
    riskTolerance: number
    qbPriority: number
    tePriority: number
  }
}

export const QUIZ_TRADES: QuizTrade[] = [
  {
    id: 1,
    scenario: "You're offered a deal for your elite young WR...",
    sideA: {
      label: "Keep Youth",
      assets: ["Marvin Harrison Jr (WR, 22)"],
    },
    sideB: {
      label: "Get Production",
      assets: ["Davante Adams (WR, 32)", "2025 1st (mid)"],
    },
    traits: { youthVsProduction: 2, consolidationVsDepth: 0, picksVsPlayers: 0, riskTolerance: 1, qbPriority: 0, tePriority: 0 },
  },
  {
    id: 2,
    scenario: "Consolidation or depth?",
    sideA: {
      label: "One Star",
      assets: ["Ja'Marr Chase (WR, 24)"],
    },
    sideB: {
      label: "Multiple Pieces",
      assets: ["DK Metcalf (WR, 27)", "Jaylen Waddle (WR, 26)", "2025 2nd"],
    },
    traits: { youthVsProduction: 0, consolidationVsDepth: 2, picksVsPlayers: 0, riskTolerance: 0, qbPriority: 0, tePriority: 0 },
  },
  {
    id: 3,
    scenario: "Picks or proven players?",
    sideA: {
      label: "Draft Capital",
      assets: ["2025 1st (early)", "2026 1st"],
    },
    sideB: {
      label: "Known Commodity",
      assets: ["Amon-Ra St. Brown (WR, 25)"],
    },
    traits: { youthVsProduction: 0, consolidationVsDepth: 0, picksVsPlayers: 2, riskTolerance: 1, qbPriority: 0, tePriority: 0 },
  },
  {
    id: 4,
    scenario: "Safe floor or boom potential?",
    sideA: {
      label: "High Ceiling",
      assets: ["Rome Odunze (WR, 22)", "2025 2nd"],
    },
    sideB: {
      label: "Proven Producer",
      assets: ["Mike Evans (WR, 31)"],
    },
    traits: { youthVsProduction: 1, consolidationVsDepth: 0, picksVsPlayers: 0, riskTolerance: 2, qbPriority: 0, tePriority: 0 },
  },
  {
    id: 5,
    scenario: "How much do you value elite QBs?",
    sideA: {
      label: "Elite QB",
      assets: ["Lamar Jackson (QB, 28)"],
    },
    sideB: {
      label: "WR1 + Pick",
      assets: ["Garrett Wilson (WR, 25)", "2025 1st (late)"],
    },
    traits: { youthVsProduction: 0, consolidationVsDepth: 0, picksVsPlayers: 0, riskTolerance: 0, qbPriority: 2, tePriority: 0 },
  },
  {
    id: 6,
    scenario: "How much do you value elite TEs?",
    sideA: {
      label: "Elite TE",
      assets: ["Brock Bowers (TE, 22)"],
    },
    sideB: {
      label: "WR2 + RB2",
      assets: ["Terry McLaurin (WR, 29)", "David Montgomery (RB, 27)"],
    },
    traits: { youthVsProduction: 0, consolidationVsDepth: 0, picksVsPlayers: 0, riskTolerance: 0, qbPriority: 0, tePriority: 2 },
  },
  {
    id: 7,
    scenario: "RB value: sell high or hold?",
    sideA: {
      label: "Sell the RB",
      assets: ["2025 1st (mid)", "2025 2nd"],
    },
    sideB: {
      label: "Keep RB Production",
      assets: ["Breece Hall (RB, 23)"],
    },
    traits: { youthVsProduction: -1, consolidationVsDepth: 0, picksVsPlayers: 1, riskTolerance: -1, qbPriority: 0, tePriority: 0 },
  },
  {
    id: 8,
    scenario: "Young upside or immediate impact?",
    sideA: {
      label: "Developmental Asset",
      assets: ["Keon Coleman (WR, 21)", "2025 2nd"],
    },
    sideB: {
      label: "Ready Now",
      assets: ["Chris Olave (WR, 24)"],
    },
    traits: { youthVsProduction: 1, consolidationVsDepth: 0, picksVsPlayers: 0, riskTolerance: 1, qbPriority: 0, tePriority: 0 },
  },
  {
    id: 9,
    scenario: "Future picks or current depth?",
    sideA: {
      label: "Future Assets",
      assets: ["2026 1st", "2026 2nd"],
    },
    sideB: {
      label: "Depth Now",
      assets: ["Zay Flowers (WR, 24)"],
    },
    traits: { youthVsProduction: 0, consolidationVsDepth: -1, picksVsPlayers: 2, riskTolerance: 0, qbPriority: 0, tePriority: 0 },
  },
  {
    id: 10,
    scenario: "The blockbuster: which side do you prefer?",
    sideA: {
      label: "Young Core",
      assets: ["Malik Nabers (WR, 21)", "2025 1st (late)"],
    },
    sideB: {
      label: "Proven + Picks",
      assets: ["CeeDee Lamb (WR, 26)", "2025 3rd"],
    },
    traits: { youthVsProduction: 2, consolidationVsDepth: 0, picksVsPlayers: 0, riskTolerance: 1, qbPriority: 0, tePriority: 0 },
  },
]

export function calculatePreferences(responses: { tradeId: number; choice: 'A' | 'B' }[]) {
  const prefs = {
    youthVsProduction: 0,
    consolidationVsDepth: 0,
    picksVsPlayers: 0,
    riskTolerance: 0,
    qbPriority: 0,
    tePriority: 0,
  }

  for (const resp of responses) {
    const trade = QUIZ_TRADES.find((t) => t.id === resp.tradeId)
    if (!trade) continue

    const multiplier = resp.choice === 'A' ? 1 : -1
    prefs.youthVsProduction += trade.traits.youthVsProduction * multiplier
    prefs.consolidationVsDepth += trade.traits.consolidationVsDepth * multiplier
    prefs.picksVsPlayers += trade.traits.picksVsPlayers * multiplier
    prefs.riskTolerance += trade.traits.riskTolerance * multiplier
    prefs.qbPriority += trade.traits.qbPriority * multiplier
    prefs.tePriority += trade.traits.tePriority * multiplier
  }

  const normalize = (val: number) => Math.max(-2, Math.min(2, val / 3))
  
  return {
    youthVsProduction: normalize(prefs.youthVsProduction),
    consolidationVsDepth: normalize(prefs.consolidationVsDepth),
    picksVsPlayers: normalize(prefs.picksVsPlayers),
    riskTolerance: normalize(prefs.riskTolerance),
    qbPriority: normalize(prefs.qbPriority),
    tePriority: normalize(prefs.tePriority),
  }
}

export function preferencesToPrompt(prefs: {
  youthVsProduction: number
  consolidationVsDepth: number
  picksVsPlayers: number
  riskTolerance: number
  qbPriority: number
  tePriority: number
}): string {
  const lines: string[] = []

  if (prefs.youthVsProduction > 0.5) {
    lines.push("- User PREFERS YOUTH over production. Prioritize young breakout candidates over proven aging vets.")
  } else if (prefs.youthVsProduction < -0.5) {
    lines.push("- User PREFERS PRODUCTION over youth. Prioritize proven producers over unproven upside.")
  }

  if (prefs.consolidationVsDepth > 0.5) {
    lines.push("- User PREFERS CONSOLIDATION. Suggest 2-for-1 deals where they get the best player.")
  } else if (prefs.consolidationVsDepth < -0.5) {
    lines.push("- User PREFERS DEPTH. Suggest deals that add multiple pieces to their roster.")
  }

  if (prefs.picksVsPlayers > 0.5) {
    lines.push("- User VALUES DRAFT PICKS highly. Include picks in trade suggestions, buy future capital.")
  } else if (prefs.picksVsPlayers < -0.5) {
    lines.push("- User PREFERS PROVEN PLAYERS over picks. Minimize pick acquisitions, target known commodities.")
  }

  if (prefs.riskTolerance > 0.5) {
    lines.push("- User has HIGH RISK TOLERANCE. Suggest boom/bust players, upside plays, and lottery tickets.")
  } else if (prefs.riskTolerance < -0.5) {
    lines.push("- User PREFERS SAFE FLOORS. Suggest established players with consistent production.")
  }

  if (prefs.qbPriority > 0.5) {
    lines.push("- User HIGHLY VALUES QBs. Prioritize QB acquisitions and don't undersell QBs.")
  } else if (prefs.qbPriority < -0.5) {
    lines.push("- User places LOWER PRIORITY on QBs. Focus on skill positions over QB upgrades.")
  }

  if (prefs.tePriority > 0.5) {
    lines.push("- User HIGHLY VALUES TEs. Prioritize elite TE acquisitions.")
  } else if (prefs.tePriority < -0.5) {
    lines.push("- User places LOWER PRIORITY on TEs. Don't overpay for TE upgrades.")
  }

  if (lines.length === 0) {
    return ""
  }

  return `\n## USER'S TRADE PREFERENCES (from quiz)\n${lines.join('\n')}\n`
}
