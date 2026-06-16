import { useEffect, useRef, useState } from 'react'
import type { Outcome } from '../lib/outcomes'
import { type DrawPhase, ROLL_MS } from '../hooks/useDrawSequence'
import { PAD_X, LIFT_H } from './PayoffBar'

const POINTER_W = 20
const POINTER_H = 24
const FRAME_MS = 16 // animation step
const N_OSC = 3.2 // how many swings before settling
const DAMP = 3.4 // higher = settles faster / less wandering near the end

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
// Fast at the start, slow at the end — drives how the swing's "time" advances.
const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4)

type Props = {
  outcomes: Outcome[]
  targetIndex: number | null // index (in `outcomes`) of the drawn segment
  phase: DrawPhase
}

// A pin that hangs over the payoff bar. It rests at the bar's center until a
// draw begins, then swings across the bar — fast at first, decelerating — and
// settles onto the drawn segment. Positioned with PayoffBar's geometry so it
// lines up exactly.
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

  const innerW = Math.max(0, w - 2 * PAD_X)
  const restX = PAD_X + innerW / 2
  const total = outcomes.reduce((s, o) => s + o.p, 0) || 1
  const centerOf = (idx: number) => {
    let cum = 0
    for (let i = 0; i < idx; i++) cum += outcomes[i].p
    return PAD_X + ((cum + outcomes[idx].p / 2) / total) * innerW
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
      // Damped oscillation that begins at the current rest position and decays
      // onto the target. Amplitude shrinks and the angular sweep slows (driven
      // by an ease-out clock), so it starts fast and eases to a stop.
      const from = leftRef.current ?? restX
      const amp = Math.max(Math.abs(from - target), innerW * 0.5)
      const phi = Math.acos(clamp((from - target) / amp, -1, 1)) // so pos(0) = from
      const t0 = performance.now()
      const id = window.setInterval(() => {
        const u = Math.min(1, (performance.now() - t0) / ROLL_MS)
        const e = easeOutQuart(u)
        const pos = target + amp * Math.exp(-DAMP * e) * Math.cos(2 * Math.PI * N_OSC * e + phi)
        setBoth(clamp(pos, PAD_X, w - PAD_X))
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

  // The wrapper stays mounted so its width can be measured; the pin shows once
  // a resting position has been computed.
  return (
    <div ref={ref} className="pointer-events-none absolute inset-x-0 top-0 z-10">
      {left !== null && (
        <div className="absolute" style={{ left: left - POINTER_W / 2, top: LIFT_H - POINTER_H + 2 }}>
          <svg width={POINTER_W} height={POINTER_H} viewBox="0 0 20 24" aria-hidden>
            <g style={{ filter: 'drop-shadow(0 2px 3px rgba(20,22,28,0.35))' }}>
              {/* teardrop / pin pointing down */}
              <path d="M10 23 L3 11 A7 7 0 1 1 17 11 Z" fill="#0AA088" />
              <circle cx="10" cy="8" r="2.6" fill="#fff" fillOpacity="0.9" />
            </g>
          </svg>
        </div>
      )}
    </div>
  )
}
