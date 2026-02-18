import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "NCAA Bracket Challenge | AllFantasy",
  description:
    "Create a March Madness bracket league and compete with friends. Live scoring, invite codes, and leaderboards.",
  openGraph: {
    title: "NCAA Bracket Challenge | AllFantasy",
    description:
      "Create a March Madness bracket league and compete with friends.",
  },
}

export default function BracketsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
