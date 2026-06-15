import { useMemo, useState } from 'react'
import {
  ASSET_CLASS_COLORS,
  INSTRUMENTS,
  type AssetClass,
  type Instrument,
} from '../lib/instruments'
import { computeFitScore } from '../lib/scoring'
import type { NormalizedScores } from '../lib/scoring'
import InstrumentList from './InstrumentList'

type Props = {
  /** Allocation slices (pct > 0), already sorted by weight desc. */
  allocation: { assetClass: AssetClass; pct: number }[]
  scores: NormalizedScores
  /** Max instruments shown per asset-class tab. Defaults to all (no cap). */
  perClassLimit?: number
}

function hexAlpha(hex: string, alpha: number): string {
  const a = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0')
  return `${hex}${a}`
}

export default function InstrumentTabs({ allocation, scores, perClassLimit = Infinity }: Props) {
  // Tabs cover the asset classes present in the suggested allocation, ordered
  // by allocation weight desc (allocation is already sorted that way).
  const classes = allocation.map((a) => a.assetClass)
  const [active, setActive] = useState<AssetClass>(classes[0])

  // Per-class top instruments by fit, computed via the fixed scoring helper.
  const byClass = useMemo(() => {
    const map = {} as Record<AssetClass, (Instrument & { fit: number })[]>
    for (const cls of classes) {
      map[cls] = INSTRUMENTS.filter((i) => i.assetClass === cls)
        .map((i) => ({ ...i, fit: computeFitScore(i, scores) }))
        .sort((a, b) => b.fit - a.fit)
        .slice(0, perClassLimit)
    }
    return map
  }, [classes.join('|'), scores, perClassLimit])

  // Guard: if for any reason the active tab fell out of the class list, reset.
  const activeClass = classes.includes(active) ? active : classes[0]
  const pctOf = (cls: AssetClass) => allocation.find((a) => a.assetClass === cls)?.pct ?? 0

  return (
    <div>
      {/* Interactive tabs — screen only */}
      <div className="screen-only">
      <div
        role="tablist"
        aria-label="Recommended instruments by asset class"
        className="-mx-1 mb-5 flex flex-wrap gap-2 px-1"
      >
        {classes.map((cls) => {
          const isActive = cls === activeClass
          const color = ASSET_CLASS_COLORS[cls]
          return (
            <button
              key={cls}
              type="button"
              role="tab"
              aria-selected={isActive}
              id={`tab-${cls}`}
              aria-controls={`panel-${cls}`}
              onClick={() => setActive(cls)}
              className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition-all duration-200 ${
                isActive
                  ? 'border-transparent bg-teal/15 text-teal shadow-soft'
                  : 'border-border bg-surface text-muted hover:text-text hover:shadow-soft'
              }`}
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="font-medium">{cls}</span>
              <span
                className="rounded-md px-1.5 py-0.5 font-mono text-[11px] font-medium tnum"
                style={
                  isActive
                    ? undefined
                    : { backgroundColor: hexAlpha(color, 0.14), color }
                }
              >
                {pctOf(cls)}%
              </span>
            </button>
          )
        })}
      </div>

      <div
        role="tabpanel"
        id={`panel-${activeClass}`}
        aria-labelledby={`tab-${activeClass}`}
      >
        {byClass[activeClass] && byClass[activeClass].length > 0 ? (
          // Fixed-height scroll area so a long class list (e.g. all equities)
          // doesn't balloon the page — scrolls internally instead.
          <div className="max-h-80 overflow-y-auto pr-2">
            <InstrumentList instruments={byClass[activeClass]} showClassBadge={false} />
          </div>
        ) : (
          <p className="py-4 text-sm text-muted">No matching instruments in this class.</p>
        )}
      </div>
      </div>

      {/* Flattened sections — print/PDF only: every allocated class stacked. */}
      <div className="print-only">
        {classes.map((cls) => (
          <div key={cls} className="print-avoid-break mb-5">
            <div className="mb-2 flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: ASSET_CLASS_COLORS[cls] }}
              />
              <span className="text-sm font-semibold text-text">{cls}</span>
              <span className="font-mono text-xs text-muted tnum">{pctOf(cls)}%</span>
            </div>
            {byClass[cls] && byClass[cls].length > 0 ? (
              <InstrumentList instruments={byClass[cls]} showClassBadge={false} />
            ) : (
              <p className="text-sm text-muted">No matching instruments in this class.</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
