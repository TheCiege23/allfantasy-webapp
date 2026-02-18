export function pointsForRound(round: number): number {
  switch (round) {
    case 0: return 0
    case 1: return 1
    case 2: return 2
    case 3: return 4
    case 4: return 8
    case 5: return 16
    case 6: return 32
    default: return 0
  }
}
