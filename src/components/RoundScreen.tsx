import { useState } from 'react'
import type { Round } from '../types'
import RoundDecision from './RoundDecision'
import LiqCards from './LiqCards'

type Props = {
  round: Round
  index: number // 1-based round number
  total: number
  onNext: (allocX: number) => void
}

export default function RoundScreen({ round, index, total, onNext }: Props) {
  const [selected, setSelected] = useState<'x' | 'y' | null>(null)

  // Allocation rounds use the PayoffBar-based decision screen.
  if (round.type === 'alloc') {
    return <RoundDecision round={round} index={index} total={total} onNext={onNext} />
  }

  // Liquidity rounds — unchanged binary card layout.
  const canAdvance = selected !== null
  const handleNext = () => {
    if (selected) onNext(selected === 'x' ? 100 : 0)
  }

  return (
    <div className="round-enter flex min-h-[100svh] w-full items-center justify-center px-6 py-10">
      <div className="flex w-full max-w-4xl flex-col">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between font-mono text-xs uppercase tracking-[0.14em] text-muted">
          <span className="rounded-full bg-surface px-3 py-1 shadow-soft">{round.tag}</span>
          <span className="tnum">
            {index} / {total}
          </span>
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

        {/* Next button */}
        <button
          type="button"
          onClick={handleNext}
          disabled={!canAdvance}
          className={`mt-7 w-full rounded-2xl py-4 text-base font-semibold transition-all duration-200 ${
            canAdvance
              ? 'bg-teal text-white shadow-soft hover:-translate-y-0.5 hover:shadow-card active:translate-y-0'
              : 'cursor-not-allowed bg-surface2 text-muted'
          }`}
        >
          {index === total ? 'See my profile' : 'Next'}
        </button>
      </div>
    </div>
  )
}
