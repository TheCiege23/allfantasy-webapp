'use client'

function normalize(values: number[]) {
  const min = Math.min(...values)
  const max = Math.max(...values)
  if (min === max) return values.map(() => 0.5)
  return values.map((v) => (v - min) / (max - min))
}

export function MomentumSparkline({ ranks, width = 160, height = 40 }: {
  ranks: number[]
  width?: number
  height?: number
}) {
  const w = width
  const h = height
  const data = ranks.length >= 2 ? ranks : [1, 1, 1]
  const inv = data.map((r) => -r)
  const n = normalize(inv)

  const pts = n.map((v, i) => {
    const x = (i / (n.length - 1)) * (w - 4) + 2
    const y = (1 - v) * (h - 4) + 2
    return `${x},${y}`
  })

  const trending = data.length >= 2 ? data[data.length - 1] < data[data.length - 2] : false
  const strokeColor = trending ? '#34d399' : '#f87171'

  return (
    <svg width={w} height={h} className="opacity-90" aria-label="Rank momentum sparkline">
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={pts.join(' ')}
      />
    </svg>
  )
}
