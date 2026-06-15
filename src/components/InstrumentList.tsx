import { ASSET_CLASS_COLORS, type AssetClass, type Instrument } from '../lib/instruments'

type Props = {
  instruments: (Instrument & { fit: number })[]
  /** Hide the per-row asset-class badge (redundant inside a per-class tab). */
  showClassBadge?: boolean
}

function hexAlpha(hex: string, alpha: number): string {
  const a = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0')
  return `${hex}${a}`
}

export default function InstrumentList({ instruments, showClassBadge = true }: Props) {
  return (
    <ul className="divide-y divide-border">
      {instruments.map((inst, i) => {
        const color = ASSET_CLASS_COLORS[inst.assetClass as AssetClass]
        return (
          <li key={`${inst.name}-${i}`} className="flex items-center gap-4 py-3">
            <span className="w-5 shrink-0 text-right font-mono text-sm text-muted tnum">
              {i + 1}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium text-text">{inst.name}</span>
                {showClassBadge && (
                  <span
                    className="shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium"
                    style={{ backgroundColor: hexAlpha(color, 0.14), color }}
                  >
                    {inst.assetClass}
                  </span>
                )}
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface2">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${inst.fit}%`, backgroundColor: color }}
                />
              </div>
            </div>

            <div className="flex w-16 shrink-0 flex-col items-end">
              <span className="font-mono text-xs text-muted">{inst.ticker}</span>
              <span className="font-mono text-sm font-medium text-text tnum">{inst.fit}</span>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
