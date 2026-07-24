import { colorForCategory, type Category, type Region } from '../lib/instruments'

export type ScatterPoint = {
  id: string
  name: string
  assetClass: Category
  vol: number // fraction
  ret: number // fraction
}

type Props = {
  points: ScatterPoint[]
  region: Region
  title: string
  xLabel: string
  yLabel: string
}

// Volatility (x) vs expected return (y), one dot per holding, colored by class.
// Pure SVG so it stays self-contained and theme-aware (axis chrome via CSS vars).
export default function RiskReturnScatter({ points, region, title, xLabel, yLabel }: Props) {
  const W = 520
  const H = 320
  const padL = 44
  const padR = 16
  const padT = 16
  const padB = 40

  const xs = points.map((p) => p.vol * 100)
  const ys = points.map((p) => p.ret * 100)
  const xMax = Math.max(5, Math.ceil((Math.max(0, ...xs) + 2) / 5) * 5)
  const yMinRaw = Math.min(0, ...ys)
  const yMax = Math.max(5, Math.ceil((Math.max(0, ...ys) + 2) / 5) * 5)
  const yMin = Math.floor(yMinRaw / 5) * 5

  const px = (v: number) => padL + (v / xMax) * (W - padL - padR)
  const py = (v: number) => H - padB - ((v - yMin) / (yMax - yMin)) * (H - padT - padB)

  const xTicks = Array.from({ length: xMax / 5 + 1 }, (_, i) => i * 5)
  const yTickStep = (yMax - yMin) / 5
  const yTicks = Array.from({ length: 6 }, (_, i) => yMin + i * yTickStep)

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
      <p className="mb-3 text-sm font-semibold text-text">{title}</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={title}>
        {/* gridlines + y ticks */}
        {yTicks.map((t) => (
          <g key={`y${t}`}>
            <line x1={padL} y1={py(t)} x2={W - padR} y2={py(t)} stroke="rgb(var(--c-hairline))" strokeWidth={1} />
            <text x={padL - 6} y={py(t) + 3} textAnchor="end" className="fill-muted" fontSize={10} fontFamily="ui-monospace, monospace">
              {Math.round(t)}
            </text>
          </g>
        ))}
        {/* x ticks */}
        {xTicks.map((t) => (
          <text key={`x${t}`} x={px(t)} y={H - padB + 14} textAnchor="middle" className="fill-muted" fontSize={10} fontFamily="ui-monospace, monospace">
            {t}
          </text>
        ))}
        {/* zero line */}
        {yMin < 0 && <line x1={padL} y1={py(0)} x2={W - padR} y2={py(0)} stroke="rgb(var(--c-border))" strokeWidth={1} />}

        {/* points */}
        {points.map((p) => (
          <circle key={p.id} cx={px(p.vol * 100)} cy={py(p.ret * 100)} r={5.5} fill={colorForCategory(p.assetClass, region)} fillOpacity={0.85}>
            <title>{`${p.name} · ${(p.vol * 100).toFixed(1)}% vol · ${(p.ret * 100).toFixed(1)}% ret`}</title>
          </circle>
        ))}

        {/* axis labels */}
        <text x={(padL + W - padR) / 2} y={H - 4} textAnchor="middle" className="fill-muted" fontSize={11}>
          {xLabel}
        </text>
        <text x={-(padT + H - padB) / 2} y={12} textAnchor="middle" transform="rotate(-90)" className="fill-muted" fontSize={11}>
          {yLabel}
        </text>
      </svg>
    </div>
  )
}
