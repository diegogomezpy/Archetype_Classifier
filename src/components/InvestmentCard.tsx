import type { DisplayMode, Scenario } from '../types'
import { money } from '../lib/format'
import Icon from './Icon'

type Props = {
  side: 'x' | 'y'
  label: string
  scenarios: Scenario[]
  amount: number
  share: number // 0-100, this card's allocation
  displayMode: DisplayMode
  ambigNote?: string
}

const INPUT = 10000

export default function InvestmentCard({
  side,
  label,
  scenarios,
  amount,
  share,
  displayMode,
  ambigNote,
}: Props) {
  const isX = side === 'x'
  const favored = share > 50

  const ring = favored
    ? isX
      ? 'border-teal/45 shadow-card'
      : 'border-amber/45 shadow-card'
    : 'border-border shadow-soft'

  return (
    <div
      className={`flex min-w-0 flex-1 flex-col rounded-2xl border bg-surface p-6 transition-all duration-300 ${ring}`}
    >
      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-mono text-base font-medium ${
              isX ? 'bg-teal/12 text-teal' : 'bg-amber/14 text-amber'
            }`}
          >
            {isX ? 'X' : 'Y'}
          </span>
          <span className="min-w-0 pt-1 text-lg font-semibold leading-snug text-text [overflow-wrap:anywhere]">
            {label}
          </span>
        </div>
        <span
          className={`shrink-0 pt-1.5 font-mono text-base font-medium tnum ${isX ? 'text-teal' : 'text-amber'}`}
        >
          {share}%
        </span>
      </div>

      {/* Scenarios — each outcome is a scannable row */}
      <div className="space-y-3">
        {scenarios.map((sc, i) => {
          const diff = sc.amt - INPUT
          const isLoss = diff < 0
          const isBreakeven = diff === 0
          const isGain = diff > 0

          const rowBg = isLoss
            ? 'bg-red/[0.06]'
            : isBreakeven
              ? 'bg-surface2/70'
              : 'bg-teal/[0.06]'

          // Primary value: relative gain/loss, or the absolute amount.
          const relative = isBreakeven ? '$0' : (isGain ? '+' : '−') + money(Math.abs(diff))
          const primary = displayMode === 'absolute' ? money(sc.amt) : relative
          const primaryColor = isLoss
            ? 'text-red'
            : isBreakeven
              ? 'text-muted'
              : displayMode === 'absolute'
                ? 'text-text'
                : 'text-teal'

          return (
            <div
              key={i}
              className={`flex items-center justify-between gap-4 rounded-xl px-4 py-3 ${rowBg}`}
            >
              {/* Likelihood */}
              <div className="min-w-0">
                <div className="font-mono text-2xl font-medium leading-none text-text tnum">
                  {sc.p}
                </div>
                <div className="mt-1.5 text-xs text-muted">{sc.note}</div>
              </div>

              {/* Outcome */}
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                    isLoss
                      ? 'bg-red/12 text-red'
                      : isBreakeven
                        ? 'bg-surface2 text-muted'
                        : 'bg-teal/14 text-teal'
                  }`}
                >
                  {isBreakeven ? (
                    <span className="h-0.5 w-3 rounded-full bg-current" />
                  ) : (
                    <Icon
                      name={isLoss ? 'arrow-down-right' : 'arrow-up-right'}
                      className="h-4 w-4"
                    />
                  )}
                </span>
                <div className="text-right">
                  <div
                    className={`font-mono text-[1.75rem] font-medium leading-none tnum ${primaryColor}`}
                  >
                    {primary}
                  </div>
                  {displayMode === 'absolute' && (
                    <div
                      className={`mt-1.5 font-mono text-xs tnum ${
                        isLoss ? 'text-red/80' : isBreakeven ? 'text-muted' : 'text-teal'
                      }`}
                    >
                      {relative}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {ambigNote && (
        <p className="mt-4 rounded-xl bg-amber/[0.08] px-4 py-3 text-sm leading-snug text-amber">
          {ambigNote}
        </p>
      )}

      {/* Live allocation footer */}
      <div className="mt-auto pt-5">
        <div className="mb-2 flex items-baseline justify-between">
          <span className={`font-mono text-2xl font-medium tnum ${isX ? 'text-teal' : 'text-amber'}`}>
            {money(amount)}
          </span>
          <span className="text-xs text-muted">allocated</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-surface2">
          <div
            className={`h-full rounded-full transition-[width] duration-150 ease-out ${
              isX ? 'bg-teal' : 'bg-amber'
            }`}
            style={{ width: `${share}%` }}
          />
        </div>
      </div>
    </div>
  )
}
