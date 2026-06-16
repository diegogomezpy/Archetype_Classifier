import { useEffect, useRef, useState } from 'react'
import type { Outcome } from '../lib/outcomes'
import { type DrawPhase, ROLL_MS } from '../hooks/useDrawSequence'
import { PAD_X, LIFT_H } from './PayoffBar'

const POINTER_W = 18
const POINTER_H = 14
const FRAME_MS = 16 // animation step
const SPINS = 2.3 // roughly how many bar-lengths it travels before resting

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
// Strong deceleration: lots of travel up front, creeping to a stop at the end.
const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4)

type Props = {
  outcomes: Outcome[]
  targetIndex: number | null // index (in `outcomes`) of the drawn segment
  phase: DrawPhase
}

// A marker that hangs over the payoff bar. It rests at the bar's center until a
// draw begins, then travels in one direction — bouncing off the bar's edges —
// decelerating until it comes to rest exactly on the drawn segment. The landing
// spot is precomputed, so the motion is a real "spin down", never a wobble
// around the answer. Positioned with PayoffBar's geometry so it lines up.
export default function DrawPointer({ outcomes, targetIndex, phase }: Props) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [w, setW] = useState(0)
  const [left, setLeft] = useState<number | null>(null)
  const leftRef = useRef<number | null>(null)
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
  const centerOf = (idx: number) => {
    let cum = 0
    for (let i = 0; i < idx; i++) cum += outcomes[i].p
    return lo + ((cum + outcomes[idx].p / 2) / total) * innerW
  }

  useEffect(() => {
    const clearTimers = () => {
      timers.current.forEach((id) => clearInterval(id))
      timers.current = []
    }
    clearTimers()
    if (w === 0) return clearTimers

    // Idle (or no draw yet): rest at the bar's center.
    if (phase === 'idle' || targetIndex === null) {
      setBoth(restX)
      return clearTimers
    }

    const target = centerOf(targetIndex)

    if (phase === 'rolling') {
      const span = innerW || 1
      const start = leftRef.current ?? restX
      const dir = Math.random() < 0.5 ? 1 : -1

      // Reflect an unfolded coordinate back into [lo, hi] (triangle wave), so
      // motion that runs past an edge "bounces" off it.
      const fold = (x: number) => {
        let p = ((x - lo) % (2 * span) + 2 * span) % (2 * span)
        return p <= span ? lo + p : lo + (2 * span - p)
      }

      // Pick the unfolded landing coordinate that (a) folds onto the target,
      // (b) lies in the travel direction, and (c) is ~SPINS bar-lengths away —
      // so the total travelled distance is fixed and it stops on the target.
      const goal = start + dir * span * SPINS
      let landing = start + dir * span * SPINS
      let bestErr = Infinity
      for (const base of [target, 2 * lo - target]) {
        for (let n = -SPINS - 2; n <= SPINS + 2; n++) {
          const x = base + 2 * span * n
          const travel = dir * (x - start)
          if (travel < span * 0.5) continue // ensure it actually spins
          const err = Math.abs(x - goal)
          if (err < bestErr) {
            bestErr = err
            landing = x
          }
        }
      }
      const distance = dir * (landing - start)

      const t0 = performance.now()
      const id = window.setInterval(() => {
        const u = Math.min(1, (performance.now() - t0) / ROLL_MS)
        const travelled = distance * easeOutQuart(u)
        setBoth(clamp(fold(start + dir * travelled), lo, hi))
        if (u >= 1) {
          clearInterval(id)
          setBoth(target)
        }
      }, FRAME_MS)
      timers.current.push(id)
    } else {
      // ticking / done — pinned on the target.
      setBoth(target)
    }
    return clearTimers
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, targetIndex, w])

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
