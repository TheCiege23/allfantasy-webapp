'use client'

import type { TeamArchetype } from '@/lib/teamClassifier'
import { motion } from 'framer-motion'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const colors: Record<TeamArchetype, string> = {
  Contender: 'from-emerald-400 to-teal-500 shadow-emerald-500/50',
  Mid: 'from-amber-400 to-orange-500 shadow-amber-500/50',
  Rebuilder: 'from-rose-400 to-purple-600 shadow-rose-500/50',
}

export default function TeamArchetypeBadge({
  archetype,
  score,
  explanation,
}: {
  archetype: TeamArchetype
  score: number
  explanation: string
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.div
            whileHover={{ scale: 1.05 }}
            className={`inline-flex items-center gap-2 px-5 py-2 rounded-2xl bg-gradient-to-r ${colors[archetype]} text-black font-bold text-sm shadow-xl cursor-default`}
          >
            <span className="text-xl">
              {archetype === 'Contender' ? '\uD83C\uDFC6' : archetype === 'Mid' ? '\u2696\uFE0F' : '\uD83D\uDD04'}
            </span>
            {archetype} \u2022 {score}
          </motion.div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs text-sm">
          {explanation}
          <div className="text-[10px] text-gray-400 mt-1">Score: {score}/100 \u2022 Updated live from your roster</div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
