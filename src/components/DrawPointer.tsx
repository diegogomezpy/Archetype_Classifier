import { useEffect, useRef, useState } from 'react'
import type { Outcome } from '../lib/outcomes'
import type { DrawPhase } from '../hooks/useDrawSequence'
import { PAD_X, LIFT_H } from './PayoffBar'

const POINTER_W = 20
const POINTER_H = 24
const SWING_INTERVAL = 28 // ms between swing frames
const SWING_SPEED = 0.16 // radians advanced per frame
const LAND_STEPS = 20 // frames to glide onto the target
const LAND_INTERVAL = 22

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

type Props = {
  outcomes: Outcome[]
  targetIndex: number | null // index (in `outcomes`) of the drawn segment
  phase: DrawPhase
}

// A pointer that hangs over the payoff bar, swings back and forth while the
// draw is "rolling", then decelerates onto the drawn segment. Positioned in the
// bar wrapper using PayoffBar's own geometry constants so it lines up exactly.
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
    const update = () => setW(el.clientWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const setBoth = (x: number) => {
    leftRef.current = x
    setLeft(x)
  }

  // Horizontal center (px) of segment `idx`, matching PayoffBar's layout.
  const innerW = Math.max(0, w - 2 * PAD_X)
  const total = outcomes.reduce((s, o) => s + o.p, 0) || 1
  const centerOf = (idx: number) => {
    let cum = 0
    for (let i = 0; i < idx; i++) cum += outcomes[i].p
    return PAD_X + ((cum + outcomes[idx].p / 2) / total) * innerW
  }

  useEffect(() => {
    const clear = () => {
      timers.current.forEach((id) => {
        clearInterval(id)
        clearTimeout(id)
      })
      timers.current = []
    }
    clear()
    if (targetIndex === null || w === 0) {
      setBoth(PAD_X + innerW / 2)
      return clear
    }

    if (phase === 'rolling') {
      let t = Math.PI / 2 // start mid-bar
      const id = window.setInterval(() => {
        t += SWING_SPEED
        setBoth(PAD_X + innerW / 2 + (innerW / 2) * Math.sin(t))
      }, SWING_INTERVAL)
      timers.current.push(id)
    } else if (phase === 'ticking' || phase === 'done') {
      const target = centerOf(targetIndex)
      const from = leftRef.current ?? target
      let i = 0
      const id = window.setInterval(() => {
        i++
        setBoth(from + (target - from) * easeOutCubic(i / LAND_STEPS))
        if (i >= LAND_STEPS) {
          clearInterval(id)
          setBoth(target)
        }
      }, LAND_INTERVAL)
      timers.current.push(id)
    }
    return clear
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, targetIndex, w])

  // The wrapper stays mounted (even when idle) so its width can be measured;
  // only the pointer itself is shown once a draw is in progress.
  const visible = left !== null && phase !== 'idle'

  return (
    <div ref={ref} className="pointer-events-none absolute inset-x-0 top-0 z-10">
      {visible && (
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
