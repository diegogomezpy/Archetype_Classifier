import { useRef, useState } from 'react'
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
// more aggressive "Growth" side (teal), Y the more conservative "Anchor" side
// (amber). Naming them — instead of bare X / Y — keeps the choice concrete.
const X_NAME = 'Growth'
const Y_NAME = 'Anchor'

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

      <div className={`flex flex-1 flex-col gap-4 p-5 ${isX ? 'bg-teal/[0.05]' : 'bg-amber/[0.05]'}`}>
        <div className="flex items-center gap-2.5">
          <span
            className={`shrink-0 rounded-lg px-2.5 py-1 font-mono text-xs font-semibold uppercase tracking-wide ${
              isX ? 'bg-teal/15 text-teal' : 'bg-amber/18 text-amber'
            }`}
          >
            {name}
          </span>
          <span className="truncate text-lg font-semibold text-text">{label}</span>
        </div>

        <div className="space-y-2.5">
          {scenarios.map((s, i) => {
            const delta = s.amt - 10000
            const color = delta < 0 ? 'text-red' : delta > 0 ? 'text-teal' : 'text-muted'
            const pct = Math.max(0, Math.min(100, parseFloat(s.p) || 0))
            return (
              <div key={i} className="rounded-xl border border-border/70 bg-surface px-4 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="flex min-w-0 items-baseline gap-2">
                    <span className="font-mono text-xl font-bold tabular-nums text-text">{s.p}</span>
                    {s.note && <span className="truncate text-xs text-muted">{s.note}</span>}
                  </div>
                  <span className={`shrink-0 font-mono text-xl font-bold tabular-nums ${color}`}>
                    {fmtDelta(delta)}
                  </span>
                </div>
                {/* Likelihood bar — width is the probability, so the most likely
                    outcomes read at a glance. */}
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border/50">
                  <div
                    className={`h-full rounded-full ${isX ? 'bg-teal/60' : 'bg-amber/60'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
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
  const [showTutorial, setShowTutorial] = useState(() => index === 1 && !tutorialSeen())
  const { phase, delta, applied, start, speedUp } = useDrawSequence()
  // The round's outcome distribution, captured on lock-in. The pointer spins to
  // a random spot and reports which segment it landed on (`handleLand`), and
  // that segment determines the drawn value — the position IS the result.
  const [outcomes, setOutcomes] = useState<Outcome[]>([])
  const [spinning, setSpinning] = useState(false)
  // Bumps when the player taps to hurry the draw; forwarded to the pointer to
  // accelerate the spin, and remembered so the count-up speeds up too.
  const [skipSignal, setSkipSignal] = useState(0)
  const skipRef = useRef(false)

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
  // Capital / Profit count-up (sped up too if the player asked to hurry).
  const handleLand = (idx: number) => {
    setSpinning(false)
    const landed = outcomes[idx]
    if (landed) {
      start(landed.end - INPUT)
      if (skipRef.current) speedUp()
    }
    skipRef.current = false
  }

  // Tap again mid-draw to hurry it along — speeds up the spin and the count-up
  // (it still animates to the real landing; nothing teleports).
  const handleSkip = () => {
    skipRef.current = true
    if (spinning) setSkipSignal((s) => s + 1)
    else if (phase === 'ticking') speedUp()
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

        {/* 2 — Distribution card. The round has no written prompt — the two
            reference cards and the payoff bar carry the choice on their own. */}
        <div className="mt-2 rounded-2xl border border-border bg-surface p-6 shadow-card">
          {/* Prominent running tally above the bar */}
          <div data-tour="capital">
            <Scoreboard capital={capital} pnl={pnl} draw={liveDraw} />
          </div>

          <div className="mt-5" />

          {/* Payoff bar — joint outcome distribution (width = probability,
              absolute-anchored color = P&L magnitude). The draw pointer overlays
              it and lands on the drawn segment. */}
          <div data-tour="bar" className="relative">
            <PayoffBar round={round} allocX={allocX} />
            <DrawPointer
              outcomes={outcomes}
              active={spinning}
              skipSignal={skipSignal}
              onLand={handleLand}
            />
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
        </div>

        {/* 4 — Read-only reference cards: each side's outcomes, always shown. */}
        <div data-tour="cards" className="mt-5 flex items-stretch gap-4">
          <ReferenceCard side="x" name={X_NAME} label={round.x.label} scenarios={round.x.scenarios} />
          <ReferenceCard side="y" name={Y_NAME} label={round.y.label} scenarios={round.y.scenarios} />
        </div>

        {/* 5 — Action button: lock in → (spin; tap again to hurry) → advance */}
        {(() => {
          const drawing = spinning || phase === 'ticking'
          const done = phase === 'done'
          return (
            <button
              data-tour="next"
              type="button"
              onClick={done ? () => onNext(allocX, delta) : drawing ? handleSkip : lockIn}
              className={`mt-7 w-full rounded-2xl py-4 text-base font-semibold shadow-soft transition-all duration-200 ${
                drawing
                  ? 'cursor-pointer bg-surface2 text-muted hover:text-text'
                  : 'bg-teal text-white hover:-translate-y-0.5 hover:shadow-card active:translate-y-0'
              }`}
            >
              {drawing ? 'Drawing… — tap to speed up' : done ? (isLast ? 'See my profile' : 'Next round') : 'Lock it in'}
            </button>
          )
        })()}
      </div>
    </div>
  )
}
