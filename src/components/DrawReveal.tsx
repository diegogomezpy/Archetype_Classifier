import { useEffect, useState } from 'react'

type Props = {
  delta: number // P&L drawn this round, vs the $10,000 stake
  prob: number | null // probability of the bucket drawn (null for deterministic liq rounds)
  runningTotal: number // cumulative P&L including this draw
  isLast: boolean
  onContinue: () => void
}

function fmtDelta(d: number): string {
  if (Math.round(d) === 0) return '$0'
  const sign = d > 0 ? '+' : '−'
  return sign + '$' + Math.abs(Math.round(d)).toLocaleString('en-US')
}

function headline(delta: number): string {
  if (Math.round(delta) > 0) return 'You came out ahead'
  if (Math.round(delta) < 0) return 'It went against you'
  return 'You broke even'
}

// Post-decision reveal: samples the player's chosen distribution and shows the
// single drawn outcome plus the running total. Single draw — no re-roll.
export default function DrawReveal({ delta, prob, runningTotal, isLast, onContinue }: Props) {
  const [show, setShow] = useState(false)
  // Brief beat before the number lands, so the reveal has a little drama.
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 120)
    return () => clearTimeout(t)
  }, [])

  const gain = Math.round(delta) > 0
  const flat = Math.round(delta) === 0
  const deltaColor = flat ? 'text-muted' : gain ? 'text-teal' : 'text-red'
  const totalColor =
    Math.round(runningTotal) === 0
      ? 'text-muted'
      : runningTotal > 0
        ? 'text-teal'
        : 'text-red'

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-text/40 px-6 backdrop-blur-[2px]">
      <div className="animate-fade-slide-up w-full max-w-sm rounded-2xl border border-border bg-surface p-7 text-center shadow-card">
        <span className="font-mono text-xs uppercase tracking-[0.16em] text-teal">The draw</span>

        <p className="mt-4 text-base font-medium text-text">{headline(delta)}</p>

        {/* The drawn result */}
        <div
          className={`mt-2 font-mono text-5xl font-semibold tnum transition-all duration-500 ${deltaColor} ${
            show ? 'scale-100 opacity-100' : 'scale-90 opacity-0'
          }`}
        >
          {fmtDelta(delta)}
        </div>

        <p className="mt-3 text-sm text-muted">
          {prob !== null ? (
            <>
              You drew the{' '}
              <span className="font-medium text-text tnum">{Math.round(prob * 100)}%</span> outcome
              from your mix
            </>
          ) : (
            'Locked in from your choice'
          )}
        </p>

        {/* Running total */}
        <div className="mt-6 rounded-xl bg-surface2 px-4 py-3">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted">Total so far</span>
            <span className={`font-mono text-lg font-semibold tnum ${totalColor}`}>
              {fmtDelta(runningTotal)}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onContinue}
          className="mt-6 w-full rounded-2xl bg-teal py-3.5 text-base font-semibold text-white shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card active:translate-y-0"
        >
          {isLast ? 'See my profile' : 'Next round'}
        </button>
      </div>
    </div>
  )
}
