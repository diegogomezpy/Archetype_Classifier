import { useState } from 'react'
import type { Round } from '../types'
import InvestmentCard from './InvestmentCard'
import AllocSlider from './AllocSlider'
import LiqCards from './LiqCards'

type Props = {
  round: Round
  index: number // 1-based round number
  total: number
  onNext: (allocX: number) => void
}

const INPUT = 10000

export default function RoundScreen({ round, index, total, onNext }: Props) {
  const [allocX, setAllocX] = useState(50)
  const [selected, setSelected] = useState<'x' | 'y' | null>(null)

  const isAlloc = round.type === 'alloc'
  const canAdvance = isAlloc || selected !== null

  const xAmount = Math.round((INPUT * allocX) / 100)
  const yAmount = INPUT - xAmount

  const handleNext = () => {
    if (isAlloc) {
      onNext(allocX)
    } else if (selected) {
      onNext(selected === 'x' ? 100 : 0)
    }
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

        {/* Nudge banner (allocation rounds) */}
        {isAlloc && (
          <div className="mt-5 inline-flex w-fit items-center gap-2 rounded-full bg-teal/10 px-4 py-2">
            <span className="h-1.5 w-1.5 rounded-full bg-teal" />
            <p className="text-sm font-medium text-teal">
              Don’t overthink — go with your first instinct
            </p>
          </div>
        )}

        {/* Body */}
        <div className="mt-7">
          {/* Reference point — always visible so outcomes read as gain/loss */}
          <div className="mb-4 inline-flex items-center gap-2 rounded-lg bg-surface px-3 py-1.5 font-mono text-xs uppercase tracking-[0.1em] text-muted shadow-soft">
            You invest <span className="font-medium text-text">$10,000</span>
          </div>

          {round.type === 'alloc' ? (
            <>
              <div className="flex items-stretch gap-6">
                <InvestmentCard
                  side="x"
                  label={round.x.label}
                  scenarios={round.x.scenarios}
                  amount={xAmount}
                  share={allocX}
                  displayMode={round.displayMode}
                  ambigNote={round.x.ambigNote}
                />
                <InvestmentCard
                  side="y"
                  label={round.y.label}
                  scenarios={round.y.scenarios}
                  amount={yAmount}
                  share={100 - allocX}
                  displayMode={round.displayMode}
                  ambigNote={round.y.ambigNote}
                />
              </div>

              <div className="mt-7">
                <AllocSlider allocX={allocX} onChange={setAllocX} />
              </div>
            </>
          ) : (
            <LiqCards x={round.x} y={round.y} selected={selected} onSelect={setSelected} />
          )}
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
