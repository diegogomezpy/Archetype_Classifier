import { useEffect, useRef, useState } from 'react'

export type DrawPhase = 'idle' | 'rolling' | 'ticking' | 'done'

// Draw sequence: an optional "rolling" window (during which the bar pointer
// swings and lands), then a count-up of the applied delta so the Capital /
// Profit figures climb into place. Timer-based so it runs regardless of tab
// visibility. ROLL_MS is shared with the pointer so they finish together.
export const ROLL_MS = 2600 // duration of the pointer's travel-and-settle
const TICK_STEPS = 26 // count-up frames
const TICK_INTERVAL = 22 // ms per count-up frame

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

export function useDrawSequence() {
  const [phase, setPhase] = useState<DrawPhase>('idle')
  const [delta, setDelta] = useState(0) // the final drawn delta
  const [applied, setApplied] = useState(0) // animates 0 → delta during ticking
  const timers = useRef<number[]>([])

  const clearAll = () => {
    timers.current.forEach((id) => {
      clearInterval(id)
      clearTimeout(id)
    })
    timers.current = []
  }
  useEffect(() => clearAll, [])

  const tickUp = (finalDelta: number) => {
    setPhase('ticking')
    let i = 0
    const id = window.setInterval(() => {
      i++
      setApplied(finalDelta * easeOutCubic(i / TICK_STEPS))
      if (i >= TICK_STEPS) {
        clearInterval(id)
        setApplied(finalDelta)
        setPhase('done')
      }
    }, TICK_INTERVAL)
    timers.current.push(id)
  }

  // Begin the sequence. `withRoll` runs the swing window first (allocation
  // rounds); omit it for a deterministic draw (liquidity rounds just count up).
  const start = (finalDelta: number, withRoll = false) => {
    clearAll()
    setDelta(finalDelta)
    setApplied(0)
    if (withRoll) {
      setPhase('rolling')
      const stop = window.setTimeout(() => tickUp(finalDelta), ROLL_MS)
      timers.current.push(stop)
    } else {
      tickUp(finalDelta)
    }
  }

  return { phase, delta, applied, start }
}
