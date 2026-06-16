import { useState } from 'react'
import type { AllocRound } from '../types'
import PayoffBar from './PayoffBar'

type Props = {
  round: AllocRound
  index: number // 1-based round number
  total: number
  onNext: (allocX: number) => void
}

function fmtDelta(delta: number): string {
  if (delta === 0) return '$0'
  const sign = delta > 0 ? '+' : '−'
  return sign + '$' + Math.abs(delta).toLocaleString('en-US')
}

function ReferenceCard({
  side,
  label,
  scenarios,
  ambigNote,
}: {
  side: 'x' | 'y'
  label: string
  scenarios: AllocRound['x']['scenarios']
  ambigNote?: string
}) {
  const isX = side === 'x'
  return (
    <div
      className={`flex flex-1 flex-col overflow-hidden rounded-2xl border bg-surface shadow-card ${
        isX ? 'border-teal/35' : 'border-amber/35'
      }`}
    >
      {/* Colored accent strip */}
      <div className={`h-1.5 w-full ${isX ? 'bg-teal' : 'bg-amber'}`} />

      <div className={`flex flex-1 flex-col gap-3.5 p-5 ${isX ? 'bg-teal/[0.05]' : 'bg-amber/[0.05]'}`}>
        <div className="flex items-center gap-2.5">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-mono text-base font-semibold ${
              isX ? 'bg-teal/15 text-teal' : 'bg-amber/18 text-amber'
            }`}
          >
            {isX ? 'X' : 'Y'}
          </span>
          <span className="truncate text-base font-semibold text-text">{label}</span>
        </div>

        <div className="space-y-2">
          {scenarios.map((s, i) => {
            const delta = s.amt - 10000
            const color = delta < 0 ? 'text-red' : delta > 0 ? 'text-teal' : 'text-muted'
            return (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="font-mono font-medium text-muted tnum">{s.p} probability</span>
                <span className="text-muted">→</span>
                <span className={`font-mono text-lg font-semibold tnum ${color}`}>
                  {fmtDelta(delta)}
                </span>
              </div>
            )
          })}
        </div>

        {/* Ambiguity caveat — the deciding detail on uncertainty/complexity/
            familiarity rounds (e.g. where X and Y have identical payoffs). */}
        {ambigNote && (
          <p className="mt-auto rounded-lg border border-border bg-surface px-3 py-2 text-xs leading-snug text-text/75">
            {ambigNote}
          </p>
        )}
      </div>
    </div>
  )
}

export default function RoundDecision({ round, index, total, onNext }: Props) {
  const [allocX, setAllocX] = useState(50)

  return (
    <div className="round-enter flex min-h-[100svh] w-full items-center justify-center px-6 py-10">
      <div className="flex w-full max-w-4xl flex-col">
        {/* 1 — Tag pill + round counter */}
        <div className="mb-6 flex items-center justify-between font-mono text-xs uppercase tracking-[0.14em] text-muted">
          <span className="rounded-full bg-surface px-3 py-1 shadow-soft">{round.tag}</span>
          <span className="tnum">
            {index} / {total}
          </span>
        </div>

        {/* 2 — Round-specific question + context (carries the meaning, esp. on
            the ambiguity rounds where the payoffs alone don't tell the story) */}
        <h2 className="text-2xl font-semibold leading-snug tracking-tight text-text">{round.q}</h2>
        <p className="mt-2.5 text-base leading-relaxed text-muted">{round.sub}</p>

        {/* 3 — Distribution card */}
        <div className="mt-7 rounded-2xl border border-border bg-surface p-6 shadow-card">
          {/* Portfolio label row */}
          <div className="mb-4 flex items-baseline justify-between">
            <span className="text-sm font-medium text-text">Your portfolio</span>
            <span className="font-mono text-sm font-medium tnum">
              <span className="text-teal">{allocX}% X</span>
              <span className="text-muted"> · </span>
              <span className="text-amber">{100 - allocX}% Y</span>
            </span>
          </div>

          {/* Payoff bar — joint outcome distribution (width = probability,
              absolute-anchored color = P&L magnitude). $10,000 baseline, dollar
              labels, and probability brackets are drawn inside. */}
          <PayoffBar round={round} allocX={allocX} />

          {/* Divider */}
          <div className="my-5 h-px w-full bg-border" />

          {/* Slider section */}
          <div className="mb-2 flex items-center justify-between text-sm font-medium">
            <span className="text-teal">← all X</span>
            <span className="text-amber">all Y →</span>
          </div>
          {/* Raw slider value is the Y-share so the thumb's left end = all X
              (matching the "← all X" / "all Y →" labels); allocX = 100 - value. */}
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={100 - allocX}
            onChange={(e) => setAllocX(100 - Number(e.target.value))}
            aria-label="Allocation between Investment X and Investment Y"
            aria-valuetext={`${allocX}% into X, ${100 - allocX}% into Y`}
            className="payoff-range w-full"
          />
          <p className="mt-3 text-center text-xs text-muted">
            Drag to split your $10,000 between X and Y
          </p>
        </div>

        {/* 4 — Read-only reference cards (incl. the ambiguity caveat per side) */}
        <div className="mt-5 flex items-stretch gap-4">
          <ReferenceCard
            side="x"
            label={round.x.label}
            scenarios={round.x.scenarios}
            ambigNote={round.x.ambigNote}
          />
          <ReferenceCard
            side="y"
            label={round.y.label}
            scenarios={round.y.scenarios}
            ambigNote={round.y.ambigNote}
          />
        </div>

        {/* 5 — Next button */}
        <button
          type="button"
          onClick={() => onNext(allocX)}
          className="mt-7 w-full rounded-2xl bg-teal py-4 text-base font-semibold text-white shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card active:translate-y-0"
        >
          {index === total ? 'See my profile' : 'Next'}
        </button>
      </div>
    </div>
  )
}
