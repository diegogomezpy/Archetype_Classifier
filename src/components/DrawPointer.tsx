import { useEffect, useRef, useState } from 'react'
import type { Outcome } from '../lib/outcomes'
import { ROLL_MS } from '../hooks/useDrawSequence'
import { PAD_X, LIFT_H } from './PayoffBar'

const POINTER_W = 18
const POINTER_H = 14
const FRAME_MS = 16 // animation step
// Random travel range, in bar-lengths. The width of this range is exactly one
// full reflection period (2 lengths), so the folded landing spot is uniform
// across the bar — i.e. each segment is hit in proportion to its width, which
// is its probability. (Don't change the 2.0 width without re-checking that.)
const MIN_SPINS = 1.6
const MAX_SPINS = 3.6

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
// Strong deceleration: lots of travel up front, creeping to a stop at the end.
const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4)

type Props = {
  outcomes: Outcome[]
  active: boolean // true while the spin is running
  onLand: (index: number) => void // reports the segment the pointer rests on
}

// A marker that hangs over the payoff bar. It rests at the bar's center until a
// draw begins, then travels in one direction — bouncing off the bar's edges —
// decelerating to a genuinely random stop. Whichever segment it lands on is the
// outcome (wider segment = more likely), so the position and the value can never
// disagree. Positioned with PayoffBar's geometry so it lines up exactly.
export default function DrawPointer({ outcomes, active, onLand }: Props) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [w, setW] = useState(0)
  const [left, setLeft] = useState<number | null>(null)
  const leftRef = useRef<number | null>(null)
  const landedRef = useRef<number | null>(null)
  const timers = useRef<number[]>([])

  // The wrapper width drives the segment layout (the canvas is w-full).
  useEffect(() => {
    const el = ref.current?.parentElement
    if (!el) return
    const update = () => setW(el.getBoundingClientRect().width)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const setBoth = (x: number) => {
    leftRef.current = x
    setLeft(x)
  }

  const lo = PAD_X
  const hi = w - PAD_X
  const innerW = Math.max(0, hi - lo)
  const restX = lo + innerW / 2
  const total = outcomes.reduce((s, o) => s + o.p, 0) || 1

  // Which segment a given x sits over (segments laid out worst→best by width).
  const segmentAt = (x: number) => {
    const frac = clamp((x - lo) / (innerW || 1), 0, 1)
    let cum = 0
    for (let i = 0; i < outcomes.length; i++) {
      cum += outcomes[i].p / total
      if (frac <= cum) return i
    }
    return outcomes.length - 1
  }

  useEffect(() => {
    const clearTimers = () => {
      timers.current.forEach((id) => clearInterval(id))
      timers.current = []
    }
    clearTimers()
    if (w === 0) return clearTimers

    if (!active) {
      // Before a draw: rest at center. After a draw: stay where it landed.
      setBoth(landedRef.current ?? restX)
      return clearTimers
    }

    // Spin: travel a random distance in one direction, bouncing off the edges
    // (reflection / fold), decelerating to a stop wherever it ends up.
    const span = innerW || 1
    const start = leftRef.current ?? restX
    const dir = Math.random() < 0.5 ? 1 : -1
    const distance = span * (MIN_SPINS + Math.random() * (MAX_SPINS - MIN_SPINS))
    const fold = (x: number) => {
      let p = ((x - lo) % (2 * span) + 2 * span) % (2 * span)
      return p <= span ? lo + p : lo + (2 * span - p)
    }

    const t0 = performance.now()
    const id = window.setInterval(() => {
      const u = Math.min(1, (performance.now() - t0) / ROLL_MS)
      const pos = fold(start + dir * distance * easeOutQuart(u))
      setBoth(clamp(pos, lo, hi))
      if (u >= 1) {
        clearInterval(id)
        const finalPos = clamp(fold(start + dir * distance), lo, hi)
        setBoth(finalPos)
        landedRef.current = finalPos
        onLand(segmentAt(finalPos))
      }
    }, FRAME_MS)
    timers.current.push(id)
    return clearTimers
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, w])

  if (w === 0) {
    // Keep the wrapper mounted so its width can be measured.
    return <div ref={ref} className="pointer-events-none absolute inset-x-0 top-0" />
  }

  return (
    <div ref={ref} className="pointer-events-none absolute inset-x-0 top-0 z-10">
      {left !== null && (
        <div
          className="absolute flex flex-col items-center"
          style={{ left: left - POINTER_W / 2, top: LIFT_H - POINTER_H - 5 }}
        >
          {/* downward triangle marker + thin stem touching the bar */}
          <svg width={POINTER_W} height={POINTER_H} viewBox="0 0 18 14" aria-hidden>
            <path
              d="M2 1 H16 a1 1 0 0 1 .8 1.6 L9.8 12.4 a1 1 0 0 1 -1.6 0 L1.2 2.6 A1 1 0 0 1 2 1 Z"
              fill="#0AA088"
              style={{ filter: 'drop-shadow(0 1px 2px rgba(20,22,28,0.3))' }}
            />
          </svg>
          <div className="h-[5px] w-px bg-[#0AA088]" />
        </div>
      )}
    </div>
  )
}
