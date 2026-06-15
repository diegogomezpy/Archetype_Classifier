type Props = {
  label: string
  value: number // [-1, 1] for core dims, [0, 1] for accessory
  interpretation: string
}

export default function DimensionScoreBar({ label, value, interpretation }: Props) {
  const magnitude = Math.min(1, Math.abs(value)) * 50 // half-width percentage
  const positive = value >= 0
  const signed = `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(2)}`

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-text">{label}</span>
        <span className="font-mono text-sm text-text tnum">{signed}</span>
      </div>

      {/* Center-anchored signed bar */}
      <div className="relative mt-2 h-2 w-full rounded-full bg-surface2">
        {/* center tick */}
        <div className="absolute left-1/2 top-1/2 h-3 w-px -translate-x-1/2 -translate-y-1/2 bg-border" />
        {positive ? (
          <div
            className="absolute left-1/2 top-0 h-full rounded-r-full bg-teal"
            style={{ width: `${magnitude}%` }}
          />
        ) : (
          <div
            className="absolute right-1/2 top-0 h-full rounded-l-full bg-amber"
            style={{ width: `${magnitude}%` }}
          />
        )}
      </div>

      <p className="mt-1.5 text-xs italic text-muted">{interpretation}</p>
    </div>
  )
}
