"use client"

import { useEffect, useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"

type Particle = {
  id: number
  x: number
  y: number
  color: string
  rotation: number
  size: number
  delay: number
}

const COLORS = ["#fb923c", "#fbbf24", "#22c55e", "#3b82f6", "#a855f7", "#ef4444", "#ec4899"]

function generateParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: -10 - Math.random() * 20,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    rotation: Math.random() * 360,
    size: 4 + Math.random() * 8,
    delay: Math.random() * 0.5,
  }))
}

export function ConfettiOverlay({ trigger, duration = 3000 }: { trigger: boolean; duration?: number }) {
  const [show, setShow] = useState(false)
  const [particles, setParticles] = useState<Particle[]>([])

  useEffect(() => {
    if (trigger) {
      setParticles(generateParticles(50))
      setShow(true)
      const timer = setTimeout(() => setShow(false), duration)
      return () => clearTimeout(timer)
    }
  }, [trigger, duration])

  if (!show) return null

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      <AnimatePresence>
        {particles.map((p) => (
          <motion.div
            key={p.id}
            initial={{
              x: `${p.x}vw`,
              y: `${p.y}vh`,
              rotate: 0,
              opacity: 1,
            }}
            animate={{
              y: "110vh",
              rotate: p.rotation + 360 * (Math.random() > 0.5 ? 1 : -1),
              x: `${p.x + (Math.random() - 0.5) * 20}vw`,
              opacity: [1, 1, 0.8, 0],
            }}
            transition={{
              duration: 2 + Math.random(),
              delay: p.delay,
              ease: "easeIn",
            }}
            style={{
              position: "absolute",
              width: p.size,
              height: p.size * 0.6,
              backgroundColor: p.color,
              borderRadius: 1,
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}

export function useConfetti() {
  const [trigger, setTrigger] = useState(false)

  const fire = useCallback(() => {
    setTrigger(false)
    requestAnimationFrame(() => setTrigger(true))
  }, [])

  return { trigger, fire, ConfettiOverlay: () => <ConfettiOverlay trigger={trigger} /> }
}
