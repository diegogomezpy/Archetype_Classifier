import { ROUNDS } from '../data/rounds'
import type { AllocRound, Scenario } from '../types'

const INPUT = 10000

export type Outcome = { p: number; delta: number }

/** Parse a probability label ("70%", "~70%", "100%") into a 0–1 fraction. */
export function parseProb(p: string): number {
  const n = parseFloat(p.replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) ? n / 100 : 0
}

/** Convert a side's scenarios into {p, delta} outcomes relative to the $10,000 input. */
export function toOutcomes(scenarios: Scenario[]): Outcome[] {
  return scenarios.map((s) => ({ p: parseProb(s.p), delta: s.amt - INPUT }))
}

/**
 * Joint outcome distribution of a portfolio that puts `allocX`% into X and the
 * rest into Y. Probabilities multiply (independent), deltas are the weighted
 * blend. Sorted by delta ascending. Outcomes are NOT merged here — the tile
 * count stays constant within a round (= |X scenarios| × |Y scenarios|), which
 * keeps the stacked-bar animation smooth (no segments appearing/disappearing).
 * Tiles that land on the same value are adjacent and same-colored, so they read
 * as one block; PayoffBar combines them only when labelling, so a duplicated
 * outcome still reports its true combined probability. (Visualization only —
 * does not feed the scoring pipeline.)
 */
export function computeJointOutcomes(
  allocX: number,
  xOutcomes: Outcome[],
  yOutcomes: Outcome[],
): Outcome[] {
  const wx = allocX / 100
  const wy = 1 - wx
  const joint: Outcome[] = []
  for (const x of xOutcomes) {
    for (const y of yOutcomes) {
      joint.push({ p: x.p * y.p, delta: Math.round(wx * x.delta + wy * y.delta) })
    }
  }
  return joint.sort((a, b) => a.delta - b.delta)
}

// Fixed axis bounds — the extreme single-outcome deltas across every allocation
// round. Computed once at module load. Any blended (joint) delta is a weighted
// average of two single deltas, so it always lands within [GLOBAL_MIN, GLOBAL_MAX].
const allAllocRounds = ROUNDS.filter((r): r is AllocRound => r.type === 'alloc')
const allDeltas = allAllocRounds.flatMap((r) =>
  [...r.x.scenarios, ...r.y.scenarios].map((s) => s.amt - INPUT),
)
export const GLOBAL_MIN = Math.min(...allDeltas)
export const GLOBAL_MAX = Math.max(...allDeltas)
