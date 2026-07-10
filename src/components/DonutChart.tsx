import { useEffect, useState } from 'react'
import { colorForCategory, type Category, type Region } from '../lib/instruments'
import { useLang } from '../i18n/i18n'
import { categoryLabel } from '../i18n/content'

type Props = {
  data: { assetClass: Category; pct: number }[]
  size?: number
  region?: Region
}

export default function DonutChart({ data, size = 200, region = 'global' }: Props) {
  const { lang } = useLang()
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  // pathLength normalized to 100 so dash values map directly to percentages.
  let cumulative = 0
  const segments = data.map((d, i) => {
    const offset = cumulative
    cumulative += d.pct
    return { ...d, offset, delay: i * 90 }
  })

  const top = data[0]

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120" width={size} height={size}>
        <g transform="rotate(-90 60 60)">
          {/* Track */}
          <circle cx="60" cy="60" r="42" fill="none" stroke="#EDEBE5" strokeWidth="22" />
          {segments.map((seg) => (
            <circle
              key={seg.assetClass}
              cx="60"
              cy="60"
              r="42"
              fill="none"
              stroke={colorForCategory(seg.assetClass, region)}
              strokeWidth="22"
              pathLength={100}
              strokeDasharray={mounted ? `${seg.pct} ${100 - seg.pct}` : `0 100`}
              strokeDashoffset={-seg.offset}
              style={{
                transition: 'stroke-dasharray 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
                transitionDelay: `${seg.delay}ms`,
              }}
            />
          ))}
        </g>
      </svg>
      {/* Center label: the dominant class */}
      {top && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="font-mono text-2xl font-medium text-text tnum">{top.pct}%</span>
          <span className="mt-0.5 max-w-[6rem] text-[11px] leading-tight text-muted">
            {categoryLabel(top.assetClass, region, lang)}
          </span>
        </div>
      )}
    </div>
  )
}
