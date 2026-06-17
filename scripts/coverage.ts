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

const shapeKeys = Object.keys(SHAPE_VECTORS) as Exclude<ArchetypeKey, 'quant'>[]

// 1) How geometrically close are the archetype vectors? (high cosine = a fragile
//    boundary — small answer changes flip the winner)
console.log('=== PAIRWISE COSINE BETWEEN SHAPE VECTORS (1.0 = identical direction) ===')
for (let i = 0; i < shapeKeys.length; i++) {
  for (let j = i + 1; j < shapeKeys.length; j++) {
    const s = cosineSim(SHAPE_VECTORS[shapeKeys[i]], SHAPE_VECTORS[shapeKeys[j]])
    console.log(`${shapeKeys[i].padEnd(9)} · ${shapeKeys[j].padEnd(9)} = ${s.toFixed(2)}`)
  }
}

const clamp = (v: number) => Math.max(0, Math.min(100, v))

function run(plays: Record<number, number>) {
  let raw = EMPTY_SCORES
  const ans: Answer[] = []
  for (const r of ROUNDS) {
    const a = plays[r.id] ?? 50
    raw = applyScore(raw, r, a)
    ans.push({ round: r, allocX: a })
  }
  return { ...normalizeScores(raw), lambda: computeLossAversion(ans) }
}

// 2) Random sweep over the plausible answer space: each contrast gets a shape
//    alloc in [0,100] and a per-player EV push in [0,50] (richer side on each
//    paired round). Tally primary archetypes, blend rate, and ambiguity.
const N = 50000
const primaryCount: Record<string, number> = {}
const margins: number[] = []
let blendCount = 0
let quantOverlay = 0 // primary shape + Quant secondary
let shapeBlend = 0 // close runner-up shape archetype
let tentativeCount = 0
let ambiguous = 0 // top-2 shape margin < 0.1 among the shape archetypes
let lowMag = 0 // shapeMag < 0.3 (no real shape signal)
const evThresholds = [0.3, 0.4, 0.45, 0.5, 0.6]
const evHits: Record<number, number> = Object.fromEntries(evThresholds.map((t) => [t, 0]))

function topTwoShapeMargin(n: { sigma: number; alpha: number; lambda: number }) {
  const sims = shapeKeys
    .map((k) => cosineSim(n, SHAPE_VECTORS[k]))
    .sort((a, b) => b - a)
  return sims[0] - sims[1]
}

for (let i = 0; i < N; i++) {
  const push = Math.random() * 50
  const plays: Record<number, number> = {}
  for (let c = 1; c <= 5; c++) {
    const shape = Math.random() * 100
    plays[c] = clamp(shape + push)
    plays[c + 5] = clamp(shape - push)
  }
  const n = run(plays)
  const mag = Math.sqrt(n.sigma ** 2 + n.alpha ** 2 + n.lambda ** 2)
  if (mag < 0.3) lowMag++
  for (const t of evThresholds) if (n.ev >= t) evHits[t]++
  const c = classify(n)
  primaryCount[c.archetype] = (primaryCount[c.archetype] ?? 0) + 1
  if (c.isBlend) blendCount++
  if (c.tentative) tentativeCount++
  if (c.secondary === 'quant') quantOverlay++
  else if (c.isBlend) shapeBlend++
  if (mag >= 0.3) {
    const m = topTwoShapeMargin(n)
    margins.push(m)
    if (m < 0.1) ambiguous++
  }
}

console.log(`\n=== PRIMARY ARCHETYPE DISTRIBUTION (${N} random players) ===`)
for (const k of [...shapeKeys, 'indexer', 'quant'] as string[]) {
  const pct = (100 * (primaryCount[k] ?? 0)) / N
  console.log(`${k.padEnd(9)} ${pct.toFixed(1).padStart(5)}%`)
}
console.log(`\nblend total: ${(100 * blendCount / N).toFixed(1)}%`)
console.log(`  · "+ Quant" overlay: ${(100 * quantOverlay / N).toFixed(1)}%`)
console.log(`  · close shape runner-up: ${(100 * shapeBlend / N).toFixed(1)}%`)
console.log(`tentative (low confidence): ${(100 * tentativeCount / N).toFixed(1)}%`)
console.log(`low shape magnitude (<0.3, EV/Indexer decides): ${(100 * lowMag / N).toFixed(1)}%`)
console.log(
  `ambiguous shape (top-2 cosine margin <0.1, of those WITH shape): ${(100 * ambiguous / margins.length).toFixed(1)}%`,
)
margins.sort((a, b) => a - b)
console.log(`median shape margin: ${margins[Math.floor(margins.length / 2)].toFixed(2)}`)

console.log('\n=== EV-GATE SWEEP (share of players who would get the Quant overlay) ===')
for (const t of evThresholds) {
  console.log(`EV_TAG ${t.toFixed(2)}  -> ${(100 * evHits[t] / N).toFixed(1)}% overlay`)
}
