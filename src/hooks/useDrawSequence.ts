import { useEffect, useRef, useState } from 'react'

export type DrawPhase = 'idle' | 'rolling' | 'ticking' | 'done'

// Slot-machine-style draw sequence: optionally cycle through candidate values
// ("rolling"), land on the final draw, then count the applied delta up from 0
// ("ticking") so the Capital / Profit figures climb into place. Timer-based so
// it runs reliably regardless of tab visibility.
const ROLL_MS = 850 // total time spent cycling candidates
const ROLL_INTERVAL = 65 // ms between candidate swaps while rolling
const TICK_STEPS = 28 // count-up frames
const TICK_INTERVAL = 22 // ms per count-up frame

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

export function useDrawSequence() {
  const [phase, setPhase] = useState<DrawPhase>('idle')
  const [roll, setRoll] = useState(0) // value shown in the "This draw" slot
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

  // Begin the sequence. `rollPool` (the round's candidate deltas) drives the
  // cycling animation; omit it for a deterministic draw (just counts up).
  const start = (finalDelta: number, rollPool?: number[]) => {
    clearAll()
    setDelta(finalDelta)
    setApplied(0)
    setRoll(finalDelta)

    if (rollPool && rollPool.length > 1) {
      setPhase('rolling')
      const spin = window.setInterval(() => {
        setRoll(rollPool[Math.floor(Math.random() * rollPool.length)])
      }, ROLL_INTERVAL)
      timers.current.push(spin)
      const stop = window.setTimeout(() => {
        clearInterval(spin)
        setRoll(finalDelta)
        tickUp(finalDelta)
      }, ROLL_MS)
      timers.current.push(stop)
    } else {
      tickUp(finalDelta)
    }
  }

  return { phase, roll, delta, applied, start }
}
