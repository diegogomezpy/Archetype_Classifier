import { useState } from 'react'
import type { Round } from '../types'
import RoundDecision from './RoundDecision'
import LiqCards from './LiqCards'
import RoundProgress from './RoundProgress'
import DrawReveal from './DrawReveal'
import { INPUT } from '../lib/outcomes'

type Props = {
  round: Round
  index: number // 1-based round number
  total: number
  runningPnl: number
  onNext: (allocX: number, drawDelta: number) => void
}

export default function RoundScreen({ round, index, total, runningPnl, onNext }: Props) {
  const [selected, setSelected] = useState<'x' | 'y' | null>(null)
  // The drawn P&L for this (liquidity) round, set on lock-in to trigger the reveal.
  const [draw, setDraw] = useState<number | null>(null)

  // Allocation rounds use the PayoffBar-based decision screen.
  if (round.type === 'alloc') {
    return (
      <RoundDecision
        round={round}
        index={index}
        total={total}
        runningPnl={runningPnl}
        onNext={onNext}
      />
    )
  }

  // Liquidity rounds — binary card pick. The chosen option's return is
  // deterministic, so the "draw" is simply that option's payoff vs the stake.
  const canAdvance = selected !== null
  const lockIn = () => {
    if (!selected) return
    const picked = selected === 'x' ? round.x : round.y
    setDraw(picked.ev - INPUT)
  }

  return (
    <div className="round-enter flex min-h-[100svh] w-full items-center justify-center px-6 py-10">
      {draw !== null && (
        <DrawReveal
          delta={draw}
          prob={null}
          runningTotal={runningPnl + draw}
          isLast={index === total}
          onContinue={() => onNext(selected === 'x' ? 100 : 0, draw)}
        />
      )}

      <div className="flex w-full max-w-4xl flex-col">
        {/* Header */}
        <div className="mb-6 flex items-center justify-end font-mono text-xs uppercase tracking-[0.14em] text-muted">
          <RoundProgress index={index} total={total} />
        </div>

        {/* Question */}
        <h2 className="text-2xl font-semibold leading-snug tracking-tight text-text">{round.q}</h2>
        <p className="mt-2.5 text-base leading-relaxed text-muted">{round.sub}</p>

        {/* Body */}
        <div className="mt-7">
          {/* Reference point — always visible so outcomes read as gain/loss */}
          <div className="mb-4 inline-flex items-center gap-2 rounded-lg bg-surface px-3 py-1.5 font-mono text-xs uppercase tracking-[0.1em] text-muted shadow-soft">
            You invest <span className="font-medium text-text">$10,000</span>
          </div>

          <LiqCards x={round.x} y={round.y} selected={selected} onSelect={setSelected} />
        </div>

        {/* Lock-in button */}
        <button
          type="button"
          onClick={lockIn}
          disabled={!canAdvance}
          className={`mt-7 w-full rounded-2xl py-4 text-base font-semibold transition-all duration-200 ${
            canAdvance
              ? 'bg-teal text-white shadow-soft hover:-translate-y-0.5 hover:shadow-card active:translate-y-0'
              : 'cursor-not-allowed bg-surface2 text-muted'
          }`}
        >
          Lock it in
        </button>
      </div>
    </div>
  )
}
