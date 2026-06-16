import { useState } from 'react'
import type { AllocRound } from '../types'
import PayoffBar from './PayoffBar'
import RoundProgress from './RoundProgress'
import Coachmarks, { tutorialSeen } from './Coachmarks'
import Scoreboard from './Scoreboard'
import DrawPointer from './DrawPointer'
import { INPUT, computeOutcomes, type Outcome } from '../lib/outcomes'
import { useDrawSequence } from '../hooks/useDrawSequence'

type Props = {
  round: AllocRound
  index: number // 1-based round number
  total: number
  runningPnl: number
  onNext: (allocX: number, drawDelta: number) => void
}

// The two sides carry a fixed identity across every round: X is always the
// more aggressive "Growth" side (teal), Y the more conservative "Steady" side
// (amber). Naming them — instead of bare X / Y — keeps the choice concrete.
const X_NAME = 'Growth'
const Y_NAME = 'Steady'

// Reference cards start expanded for the first few rounds, then collapse by
// default once the format is familiar.
const EXPAND_CARDS_THROUGH = 3

function fmtMoney(n: number): string {
  return '$' + n.toLocaleString('en-US')
}

function fmtDelta(delta: number): string {
  if (delta === 0) return '$0'
  const sign = delta > 0 ? '+' : '−'
  return sign + '$' + Math.abs(delta).toLocaleString('en-US')
}

function ReferenceCard({
  side,
  name,
  label,
  scenarios,
}: {
  side: 'x' | 'y'
  name: string
  label: string
  scenarios: AllocRound['x']['scenarios']
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
            className={`shrink-0 rounded-lg px-2.5 py-1 font-mono text-xs font-semibold uppercase tracking-wide ${
              isX ? 'bg-teal/15 text-teal' : 'bg-amber/18 text-amber'
            }`}
          >
            {name}
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
      </div>
    </div>
  )
}

export default function RoundDecision({ round, index, total, runningPnl, onNext }: Props) {
  const [allocX, setAllocX] = useState(50)
  const [showCards, setShowCards] = useState(index <= EXPAND_CARDS_THROUGH)
  const [showTutorial, setShowTutorial] = useState(() => index === 1 && !tutorialSeen())
  const { phase, delta, applied, start } = useDrawSequence()
  // The round's outcome distribution, captured on lock-in. The pointer spins to
  // a random spot and reports which segment it landed on (`handleLand`), and
  // that segment determines the drawn value — the position IS the result.
  const [outcomes, setOutcomes] = useState<Outcome[]>([])
  const [spinning, setSpinning] = useState(false)

  const xDollars = allocX * 100
  const yDollars = (100 - allocX) * 100

  const locked = spinning || phase !== 'idle'
  const capital = INPUT + runningPnl + applied
  const pnl = runningPnl + applied
  // "This draw" appears once the pointer has landed (during/after the tick).
  const liveDraw = phase === 'ticking' || phase === 'done' ? delta : null

  const lockIn = () => {
    setOutcomes(computeOutcomes(round, allocX))
    setSpinning(true)
  }

  // Pointer has come to rest on segment `idx` — read off the value and run the
  // Capital / Profit count-up.
  const handleLand = (idx: number) => {
    setSpinning(false)
    const landed = outcomes[idx]
    if (landed) start(landed.end - INPUT)
  }

  const isLast = index === total

  return (
    <div className="round-enter flex min-h-[100svh] w-full items-center justify-center px-6 py-10">
      {showTutorial && <Coachmarks onClose={() => setShowTutorial(false)} />}

      <div className="flex w-full max-w-4xl flex-col">
        {/* 1 — "How it works" replay + segmented progress */}
        <div className="mb-6 flex items-center justify-between font-mono text-xs uppercase tracking-[0.14em] text-muted">
          <button
            type="button"
            onClick={() => setShowTutorial(true)}
            className="flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 normal-case tracking-normal shadow-soft transition-colors hover:text-text"
          >
            <span aria-hidden className="text-sm leading-none">
              ⓘ
            </span>
            How it works
          </button>
          <RoundProgress index={index} total={total} />
        </div>

        {/* 2 — Round-specific question + context */}
        <h2 className="text-2xl font-semibold leading-snug tracking-tight text-text">{round.q}</h2>
        <p className="mt-2.5 text-base leading-relaxed text-muted">{round.sub}</p>

        {/* 3 — Distribution card */}
        <div className="mt-7 rounded-2xl border border-border bg-surface p-6 shadow-card">
          {/* Prominent running tally above the bar */}
          <Scoreboard capital={capital} pnl={pnl} draw={liveDraw} />

          {/* Plain-language mix readout */}
          <div className="mb-4 mt-4 flex items-baseline justify-between border-t border-border pt-4">
            <span className="text-sm font-medium text-text">Your mix</span>
            <span className="text-sm tnum">
              <span className="font-mono font-medium text-teal">{fmtMoney(xDollars)}</span>
              <span className="text-muted"> in {X_NAME} · </span>
              <span className="font-mono font-medium text-amber">{fmtMoney(yDollars)}</span>
              <span className="text-muted"> in {Y_NAME}</span>
            </span>
          </div>

          {/* Payoff bar — joint outcome distribution (width = probability,
              absolute-anchored color = P&L magnitude). The draw pointer overlays
              it and lands on the drawn segment. */}
          <div data-tour="bar" className="relative">
            <PayoffBar round={round} allocX={allocX} />
            <DrawPointer outcomes={outcomes} active={spinning} onLand={handleLand} />
          </div>

          {/* Legend — shown only on the first round, while the format is new. */}
          {index === 1 && (
            <p className="mt-3 text-center text-xs text-muted">
              Wider = more likely · <span className="text-teal">green = gain</span> ·{' '}
              <span className="text-red">red = loss</span>
            </p>
          )}

          {/* Divider */}
          <div className="my-5 h-px w-full bg-border" />

          {/* Slider section — locked once the draw is rolling */}
          <div className="mb-2 flex items-center justify-between text-sm font-medium">
            <span className="text-teal">← all {X_NAME}</span>
            <span className="text-amber">all {Y_NAME} →</span>
          </div>
          {/* Raw slider value is the Y-share so the thumb's left end = all Growth
              (matching the labels); allocX = 100 - value. */}
          <input
            data-tour="slider"
            type="range"
            min={0}
            max={100}
            step={1}
            value={100 - allocX}
            disabled={locked}
            onChange={(e) => setAllocX(100 - Number(e.target.value))}
            aria-label={`Allocation between ${X_NAME} and ${Y_NAME}`}
            aria-valuetext={`${fmtMoney(xDollars)} into ${X_NAME}, ${fmtMoney(yDollars)} into ${Y_NAME}`}
            className={`payoff-range w-full ${locked ? 'opacity-50' : ''}`}
          />
          <p className="mt-3 text-center text-xs text-muted">
            Drag to split your $10,000 between {X_NAME} and {Y_NAME}
          </p>
        </div>

        {/* 4 — Read-only reference cards, collapsible once the format is known */}
        <div className="mt-5">
          <button
            type="button"
            onClick={() => setShowCards((v) => !v)}
            className="flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-text"
            aria-expanded={showCards}
          >
            {showCards ? 'Hide the details' : 'Show the details'}
            <span className={`text-xs transition-transform ${showCards ? 'rotate-180' : ''}`}>▾</span>
          </button>

          {showCards && (
            <div className="mt-4 flex items-stretch gap-4">
              <ReferenceCard side="x" name={X_NAME} label={round.x.label} scenarios={round.x.scenarios} />
              <ReferenceCard side="y" name={Y_NAME} label={round.y.label} scenarios={round.y.scenarios} />
            </div>
          )}
        </div>

        {/* 5 — Action button: lock in → (spin + draw resolves) → advance */}
        {(() => {
          const drawing = spinning || phase === 'ticking'
          const done = phase === 'done'
          return (
            <button
              data-tour="next"
              type="button"
              disabled={drawing}
              onClick={done ? () => onNext(allocX, delta) : !drawing ? lockIn : undefined}
              className={`mt-7 w-full rounded-2xl py-4 text-base font-semibold shadow-soft transition-all duration-200 ${
                drawing
                  ? 'cursor-default bg-surface2 text-muted'
                  : 'bg-teal text-white hover:-translate-y-0.5 hover:shadow-card active:translate-y-0'
              }`}
            >
              {drawing ? 'Drawing…' : done ? (isLast ? 'See my profile' : 'Next round') : 'Lock it in'}
            </button>
          )
        })()}
      </div>
    </div>
  )
}
