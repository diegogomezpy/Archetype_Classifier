import { ROUNDS } from '../src/data/rounds'
import {
  EMPTY_SCORES,
  applyScore,
  normalizeScores,
  classify,
  cosineSim,
  computeLossAversion,
  SHAPE_VECTORS,
  type Answer,
} from '../src/lib/scoring'
import type { ArchetypeKey } from '../src/data/archetypes'

// Paired design: contrast c (1..5) = round c (aggressive X richer) and round
// c+5 (calm Y richer). A pure-shape player answers BOTH rounds of a pair the
// same way (shape only). An EV-disciplined player nudges toward the richer side:
// +push toward X on rounds 1-5, +push toward Y on rounds 6-10.
type ShapeAlloc = Record<number, number> // contrast 1..5 -> allocX (0..100)

const pureShape: Record<Exclude<ArchetypeKey, 'quant'>, ShapeAlloc> = {
  // Banker: low variance, shuns the rare-big-loss side AND the lottery (α nets
  // ~0), strongly loss-averse (all-safe on the loss round).
  banker: { 1: 20, 2: 70, 3: 0, 4: 30, 5: 30 },
  // Venture: high variance, chases positive skew, loss-tolerant.
  venture: { 1: 80, 2: 95, 3: 70, 4: 85, 5: 95 },
  // Insurer: mildly low variance, strong negative skew (leans Anchor on skew
  // rounds), loss-neutral.
  insurer: { 1: 40, 2: 5, 3: 50, 4: 35, 5: 15 },
  // Indexer: dead-center (no tilt at all).
  indexer: { 1: 50, 2: 50, 3: 50, 4: 50, 5: 50 },
}

const clamp = (v: number) => Math.max(0, Math.min(100, v))

// Build the 10 allocX answers for a player given their per-contrast shape and an
// EV-discipline "push" (0 = pure shape, 100 = always take the richer side).
function answers(shape: ShapeAlloc, push: number): Record<number, number> {
  const out: Record<number, number> = {}
  for (let c = 1; c <= 5; c++) {
    out[c] = clamp(shape[c] + push) // rounds 1-5: richer side is X (push up)
    out[c + 5] = clamp(shape[c] - push) // rounds 6-10: richer side is Y (push down)
  }
  return out
}

function run(plays: Record<number, number>) {
  let raw = EMPTY_SCORES
  const ans: Answer[] = []
  for (const r of ROUNDS) {
    const allocX = plays[r.id] ?? 50
    raw = applyScore(raw, r, allocX)
    ans.push({ round: r, allocX })
  }
  // Mirror buildDashboardData: λ comes from realized downside, not the linear sum.
  return { ...normalizeScores(raw), lambda: computeLossAversion(ans) }
}

// Cosine competitors (banker/venture/insurer); the Indexer is the low-conviction
// outcome, not a vector — but we still test it as a persona below.
const shapeKeys = Object.keys(SHAPE_VECTORS) as (keyof typeof SHAPE_VECTORS)[]
const personaKeys = ['banker', 'venture', 'insurer', 'indexer'] as const
function topShape(n: { sigma: number; alpha: number; lambda: number }) {
  return shapeKeys
    .map((k) => ({ k, s: cosineSim(n, SHAPE_VECTORS[k]) }))
    .sort((a, b) => b.s - a.s)
}

function show(label: string, plays: Record<number, number>) {
  const n = run(plays)
  const c = classify(n)
  const rep = topShape(n)
  const margin = (rep[0].s - rep[1].s).toFixed(2)
  const tag = c.tentative ? ' [tentative]' : ''
  console.log(
    `${label.padEnd(26)} -> ${(c.archetype + (c.isBlend && c.secondary ? ' + ' + c.secondary : '')).padEnd(24)} ` +
      `σ=${n.sigma.toFixed(2)} α=${n.alpha.toFixed(2)} λ=${n.lambda.toFixed(2)} ev=${n.ev.toFixed(2)}  ` +
      `conf=${c.confidence.toFixed(2)}${tag}`,
  )
}

console.log('=== PURE SHAPE (answers each pair identically; ev should be ~0, no Quant) ===')
for (const a of personaKeys) show(`pure ${a}`, answers(pureShape[a], 0))

console.log('\n=== MARKET BETA (high variance tolerance, flat skew & loss view -> Indexer) ===')
show('market beta', answers({ 1: 95, 2: 50, 3: 50, 4: 50, 5: 50 }, 0))

console.log('\n=== MODERATE EV-DISCIPLINE (push 35; expect <archetype> + quant) ===')
for (const a of personaKeys) show(`disciplined ${a}`, answers(pureShape[a], 35))

console.log('\n=== DISCIPLINE SWEEP (banker, push 0->80) ===')
for (let p = 0; p <= 80; p += 10) show(`banker push ${p}`, answers(pureShape.banker, p))

console.log('\n=== PURE QUANT (always takes richer side, no shape) ===')
show('pure quant', answers({ 1: 50, 2: 50, 3: 50, 4: 50, 5: 50 }, 50))
