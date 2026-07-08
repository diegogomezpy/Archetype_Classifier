import { useEffect, useRef, useState } from 'react'

export type DrawPhase = 'idle' | 'ticking' | 'done'

// Draw sequence: the bar pointer swings and lands (owned by DrawPointer), then a
// count-up of the applied delta runs here so the Capital / Profit figures climb
// into place. Timer-based so it runs regardless of tab visibility. ROLL_MS is
// shared with the pointer so the spin and this sequence stay in step.
export const ROLL_MS = 2600 // duration of the pointer's travel-and-settle
const TICK_STEPS = 26 // count-up frames
const TICK_INTERVAL = 22 // ms per count-up frame

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

export function useDrawSequence() {
  const [phase, setPhase] = useState<DrawPhase>('idle')
  const [delta, setDelta] = useState(0) // the final drawn delta
  const [applied, setApplied] = useState(0) // animates 0 → delta during ticking
  const speedRef = useRef(1) // count-up speed multiplier (bumped when skipping)
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
      i += speedRef.current // advance faster while sped up
      const t = Math.min(1, i / TICK_STEPS)
      setApplied(finalDelta * easeOutCubic(t))
      if (i >= TICK_STEPS) {
        clearInterval(id)
        setApplied(finalDelta)
        setPhase('done')
      }
    }, TICK_INTERVAL)
    timers.current.push(id)
  }

  // Begin the sequence: the pointer owns the spin, so we go straight to the
  // count-up of the drawn delta.
  const start = (finalDelta: number) => {
    clearAll()
    speedRef.current = 1
    setDelta(finalDelta)
    setApplied(0)
    tickUp(finalDelta)
  }

  // Speed the count-up up (the player tapped to hurry the draw along). It still
  // animates to the figure — just faster.
  const speedUp = (factor = 5) => {
    speedRef.current = factor
  }

  return { phase, delta, applied, start, speedUp }
}
