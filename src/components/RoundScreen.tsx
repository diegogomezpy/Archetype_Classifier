import { useState } from 'react'
import type { Round } from '../types'
import RoundDecision from './RoundDecision'
import LiqCards from './LiqCards'
import RoundProgress from './RoundProgress'
import Scoreboard from './Scoreboard'
import { INPUT } from '../lib/outcomes'
import { useDrawSequence } from '../hooks/useDrawSequence'

type Props = {
  round: Round
  index: number // 1-based round number
  total: number
  runningPnl: number
  onNext: (allocX: number, drawDelta: number) => void
}

export default function RoundScreen({ round, index, total, runningPnl, onNext }: Props) {
  const [selected, setSelected] = useState<'x' | 'y' | null>(null)
  const { phase, delta, applied, start } = useDrawSequence()

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
  // deterministic, so the "draw" just counts up to that option's payoff.
  const locked = phase !== 'idle'
  const canAdvance = selected !== null
  const capital = INPUT + runningPnl + applied
  const pnl = runningPnl + applied
  const liveDraw = phase === 'idle' ? null : delta
  const isLast = index === total

  const lockIn = () => {
    if (!selected) return
    const picked = selected === 'x' ? round.x : round.y
    start(picked.ev - INPUT)
  }

  return (
    <div className="round-enter flex min-h-[100svh] w-full items-center justify-center px-6 py-10">
      <div className="flex w-full max-w-4xl flex-col">
        {/* Header */}
        <div className="mb-6 flex items-center justify-end font-mono text-xs uppercase tracking-[0.14em] text-muted">
          <RoundProgress index={index} total={total} />
        </div>

        {/* Question */}
        <h2 className="text-2xl font-semibold leading-snug tracking-tight text-text">{round.q}</h2>
        <p className="mt-2.5 text-base leading-relaxed text-muted">{round.sub}</p>

        {/* Running tally */}
        <div className="mt-6 rounded-2xl border border-border bg-surface p-5 shadow-soft">
          <Scoreboard capital={capital} pnl={pnl} draw={liveDraw} />
        </div>

        {/* Body */}
        <div className="mt-6">
          <LiqCards x={round.x} y={round.y} selected={selected} onSelect={locked ? () => {} : setSelected} />
        </div>

        {/* Action button: lock in → (draw resolves) → advance */}
        <button
          type="button"
          disabled={(!canAdvance && phase === 'idle') || phase === 'ticking'}
          onClick={
            phase === 'done'
              ? () => onNext(selected === 'x' ? 100 : 0, delta)
              : phase === 'idle'
                ? lockIn
                : undefined
          }
          className={`mt-7 w-full rounded-2xl py-4 text-base font-semibold transition-all duration-200 ${
            (canAdvance || phase !== 'idle') && phase !== 'ticking'
              ? 'bg-teal text-white shadow-soft hover:-translate-y-0.5 hover:shadow-card active:translate-y-0'
              : 'cursor-not-allowed bg-surface2 text-muted'
          }`}
        >
          {phase === 'idle'
            ? 'Lock it in'
            : phase === 'done'
              ? isLast
                ? 'See my profile'
                : 'Next round'
              : 'Drawing…'}
        </button>
      </div>
    </div>
  )
}
