import type { AllocRound } from '../types'

// Portfolio input; scenario.amt is the ending value for a $10,000 stake.
export const INPUT = 10000

export type Outcome = { end: number; p: number }

export function parseProb(p: string): number {
  const n = parseFloat(p.replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) ? n / 100 : 0
}

// Joint portfolio outcome distribution for the current X/Y split. Each (X, Y)
// scenario pair is combined by its share of the $10,000, merged by rounded
// ending value, and sorted worst → best. Probabilities sum to ~1.
export function computeOutcomes(round: AllocRound, allocX: number): Outcome[] {
  const xAmt = (INPUT * allocX) / 100
  const yAmt = INPUT - xAmt
  const merged = new Map<number, number>()
  for (const sx of round.x.scenarios) {
    for (const sy of round.y.scenarios) {
      const end = (sx.amt / INPUT) * xAmt + (sy.amt / INPUT) * yAmt
      const prob = parseProb(sx.p) * parseProb(sy.p)
      const key = Math.round(end)
      merged.set(key, (merged.get(key) ?? 0) + prob)
    }
  }
  return [...merged.entries()]
    .filter(([, p]) => p >= 0.0001)
    .map(([end, p]) => ({ end, p }))
    .sort((a, b) => a.end - b.end)
}

// Draw one outcome from the distribution, weighted by probability. Returns the
// sampled ending value and the probability of the bucket it landed in.
export function sampleOutcome(outcomes: Outcome[]): Outcome {
  const total = outcomes.reduce((s, o) => s + o.p, 0) || 1
  let r = Math.random() * total
  for (const o of outcomes) {
    r -= o.p
    if (r <= 0) return o
  }
  return outcomes[outcomes.length - 1]
}
