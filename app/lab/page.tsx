import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/get-current-user"
import { getActiveTournament } from "@/lib/tournament"
import { getEntitlementsForUser } from "@/lib/entitlements-db"
import { LabDashboardShell } from "@/components/lab/LabDashboardShell"

export default async function LabPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/login?next=/lab")

  const tournament = await getActiveTournament()
  if (!tournament) redirect("/")

  const ent = await getEntitlementsForUser(user.id, tournament.id)

  const hasPass = ent.hasBracketLabPass

  if (!hasPass) redirect(`/ai-lab?locked=1&tournament=${tournament.id}`)

  return (
    <LabDashboardShell
      userId={user.id}
      tournamentId={tournament.id}
      tournamentName={tournament.name}
    />
  )
}
