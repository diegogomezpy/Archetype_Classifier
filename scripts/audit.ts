import { ROUNDS } from '../src/data/rounds'
import {
  EMPTY_SCORES,
  applyScore,
  normalizeScores,
  classify,
  cosineSim,
  SHAPE_VECTORS,
} from '../src/lib/scoring'
import type { ArchetypeKey } from '../src/data/archetypes'

// Paired design: contrast c (1..5) = round c (aggressive X richer) and round
// c+5 (calm Y richer). A pure-shape player answers BOTH rounds of a pair the
// same way (shape only). An EV-disciplined player nudges toward the richer side:
// +push toward X on rounds 1-5, +push toward Y on rounds 6-10.
type ShapeAlloc = Record<number, number> // contrast 1..5 -> allocX (0..100)

const pureShape: Record<Exclude<ArchetypeKey, 'optimizer'>, ShapeAlloc> = {
  protector: { 1: 25, 2: 40, 3: 0, 4: 25, 5: 15 },
  pioneer: { 1: 75, 2: 100, 3: 65, 4: 85, 5: 100 },
  carry: { 1: 60, 2: 0, 3: 50, 4: 35, 5: 15 },
  agnostic: { 1: 50, 2: 50, 3: 50, 4: 50, 5: 50 },
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
  for (const r of ROUNDS) raw = applyScore(raw, r, plays[r.id] ?? 50)
  return normalizeScores(raw)
}

const shapeKeys = Object.keys(SHAPE_VECTORS) as Exclude<ArchetypeKey, 'optimizer'>[]
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
  console.log(
    `${label.padEnd(26)} -> ${(c.archetype + (c.isBlend && c.secondary ? ' + ' + c.secondary : '')).padEnd(24)} ` +
      `σ=${n.sigma.toFixed(2)} α=${n.alpha.toFixed(2)} λ=${n.lambda.toFixed(2)} ev=${n.ev.toFixed(2)}  (shape margin ${margin})`,
  )
}

console.log('=== PURE SHAPE (answers each pair identically; ev should be ~0, no Optimizer) ===')
for (const a of shapeKeys) show(`pure ${a}`, answers(pureShape[a], 0))

console.log('\n=== MODERATE EV-DISCIPLINE (push 35; expect <archetype> + optimizer) ===')
for (const a of shapeKeys) show(`disciplined ${a}`, answers(pureShape[a], 35))

console.log('\n=== DISCIPLINE SWEEP (protector, push 0->80) ===')
for (let p = 0; p <= 80; p += 10) show(`protector push ${p}`, answers(pureShape.protector, p))

console.log('\n=== PURE OPTIMIZER (always takes richer side, no shape) ===')
show('pure optimizer', answers({ 1: 50, 2: 50, 3: 50, 4: 50, 5: 50 }, 50))
