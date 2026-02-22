import { prisma } from "@/lib/prisma"
import type { Entitlements } from "@/lib/entitlements"

export async function getEntitlementsForUser(userId: string, tournamentId?: string): Promise<Entitlements> {
  const labWhere: any = {
    userId,
    paymentType: "bracket_lab_pass",
    status: "completed",
  }
  if (tournamentId) {
    labWhere.tournamentId = tournamentId
  }

  const labPayment = await (prisma as any).bracketPayment.findFirst({
    where: labWhere,
    orderBy: { createdAt: "desc" },
    select: { tournamentId: true },
  }).catch(() => null)

  const donationPayment = await (prisma as any).bracketPayment.findFirst({
    where: {
      userId,
      paymentType: "donation",
      status: "completed",
    },
    select: { id: true },
  }).catch(() => null)

  return {
    hasBracketLabPass: !!labPayment,
    bracketLabPassTournamentId: labPayment?.tournamentId ?? undefined,
    isSupporter: !!donationPayment,
  }
}
