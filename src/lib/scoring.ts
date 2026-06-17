import type { Round, Scores } from '../types'
import type { ArchetypeKey } from '../data/archetypes'
import {
  INSTRUMENTS,
  type AssetClass,
  type Instrument,
} from './instruments'
import { computeOutcomes, INPUT } from './outcomes'

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

export const EMPTY_SCORES: Scores = { sigma: 0, alpha: 0, lambda: 0, ev: 0 }

/**
 * Per-round scoring contributions (10-round paired all-mismatched design).
 * Every round is an allocation slider: Growth (X) is always the more aggressive
 * side, so the signal is monotone: s = (allocX - 50) / 50 ∈ [-1, +1]; positive
 * s = leaning toward X. Shape weights are signed in the X-direction.
 *
 * Rounds come in pairs sharing a shape contrast (ids n and n+5):
 *   1/6  variance (σ), gain-only
 *   2/7  skew (α)
 *   3/8  loss aversion (a little σ; λ read separately — see below)
 *   4/9  combined risk profile (σ + α; λ read separately)
 *   5/10 lottery skew (α)
 * Both rounds of a pair carry IDENTICAL shape weights (X is the aggressive side
 * in both), so the shape signal is the pair's average. The `ev` weight FLIPS
 * sign between them: +2 when the richer side is X (the "a"/screen-1 round), -2
 * when the richer side is Y (the "b"/screen-2 round). A player who answers on
 * pure shape gives the same slider both times → the ev contributions cancel; a
 * player who chases the richer side splits them → ev accumulates. That's the
 * EV-discipline (Optimizer) signal, isolated from shape.
 *
 * NOTE: λ (loss aversion) is NOT scored here. A linear slider weight conflated
 * it with σ, so λ is instead read from the realized downside the player took on
 * — expected shortfall — in computeLossAversion() below.
 */
export const ROUND_SCORES: Record<
  number,
  { dim: 'sigma' | 'alpha' | 'lambda' | 'ev'; weight: number }[]
> = {
  // ── screen 1: the "a" rounds, aggressive side (X) is the richer one ──
  1: [{ dim: 'sigma', weight: 2 }, { dim: 'ev', weight: 2 }],
  2: [{ dim: 'alpha', weight: 2 }, { dim: 'ev', weight: 2 }],
  3: [{ dim: 'sigma', weight: 1 }, { dim: 'ev', weight: 2 }],
  4: [
    { dim: 'sigma', weight: 1 },
    { dim: 'alpha', weight: 1 },
    { dim: 'ev', weight: 2 },
  ],
  5: [{ dim: 'alpha', weight: 2 }, { dim: 'ev', weight: 2 }],
  // ── screen 2: the "b" rounds, calm side (Y) is the richer one (ev flips) ──
  6: [{ dim: 'sigma', weight: 2 }, { dim: 'ev', weight: -2 }],
  7: [{ dim: 'alpha', weight: 2 }, { dim: 'ev', weight: -2 }],
  8: [{ dim: 'sigma', weight: 1 }, { dim: 'ev', weight: -2 }],
  9: [
    { dim: 'sigma', weight: 1 },
    { dim: 'alpha', weight: 1 },
    { dim: 'ev', weight: -2 },
  ],
  10: [{ dim: 'alpha', weight: 2 }, { dim: 'ev', weight: -2 }],
}

/**
 * Accumulate a round's contribution into the raw score accumulator. The slider
 * value maps to a monotone signal and is scaled by the signed ROUND_SCORES
 * weights.
 */
export function applyScore(acc: Scores, round: Round, allocX: number): Scores {
  const next: Scores = { ...acc }
  const signal = (allocX - 50) / 50 // [-1, +1]

  for (const { dim, weight } of ROUND_SCORES[round.id] ?? []) {
    next[dim] += weight * signal
  }
  return next
}

export type NormalizedScores = {
  sigma: number // [-1, 1] variance tolerance
  alpha: number // [-1, 1] skew preference (positive = seeks positive skew)
  lambda: number // [-1, 1] loss aversion (positive = more loss averse)
  ev: number // [-1, 1] EV-discipline (positive = chases higher expected value)
}

// Normalization denominators = sum of |weights| per dimension across all rounds.
// sigma:  1(2)+3(1)+4(1)+6(2)+8(1)+9(1)            = 8
// alpha:  2(2)+4(1)+5(2)+7(2)+9(1)+10(2)           = 10
// ev:     10 rounds × 2                            = 20
// (λ is NOT accumulated linearly — see computeLossAversion below.)
const NORM_SIGMA = 8
const NORM_ALPHA = 10
const NORM_EV = 20

export function normalizeScores(raw: Scores): NormalizedScores {
  return {
    sigma: clamp(raw.sigma / NORM_SIGMA, -1, 1),
    alpha: clamp(raw.alpha / NORM_ALPHA, -1, 1),
    // Placeholder — λ is derived from realized downside (expected shortfall) in
    // buildDashboardData via computeLossAversion, not from a linear weight sum.
    lambda: 0,
    ev: clamp(raw.ev / NORM_EV, -1, 1),
  }
}

// ---------------------------------------------------------------------------
// Loss aversion (λ) from realized downside — expected shortfall
// ---------------------------------------------------------------------------

export type Answer = { round: Round; allocX: number }

// λ is read from how much downside the player actually took on, via EXPECTED
// SHORTFALL — the probability-weighted expected loss below the $10k input. We
// compute each side's standalone shortfall (esX = all-Growth, esY = all-Anchor)
// and score how far the player leaned toward the SAFER (lower-shortfall) side.
// Leaning to the safer side = loss-averse; leaning to the riskier side = loss-
// tolerant; a neutral 50/50 split is exactly λ-neutral.
//
// Why the per-side reading, not the shortfall of the actual mix: shortfall of
// the blended portfolio is convex in the split, so a diversified ~50/50 player
// can sit at (or below) the downside minimum purely from decorrelation — and a
// naive "took the least loss available" reading would mislabel them as maximally
// loss-averse. Scoring the lean between the two sides is linear in the split, so
// diversification can't masquerade as loss aversion.
//
// The two SKEW contrasts (tags 'Skew' and 'Long shot') are deliberately
// EXCLUDED: there the loss tail is a frequency/size trade driven by skew taste
// (e.g. the lottery's aggressive side carries a small, frequent loss), so its
// shortfall reflects α, not loss aversion. λ is read only from the genuine
// depth-of-loss rounds (loss-aversion + combined risk-profile contrasts);
// gain-only rounds have equal (zero) shortfall on both sides and drop out.
const LAMBDA_EXCLUDED_TAGS = new Set(['Skew', 'Long shot'])

// Expected shortfall of a split: Σ p·max(0, INPUT − outcome).
export function expectedShortfall(round: Round, allocX: number): number {
  return computeOutcomes(round, allocX).reduce(
    (s, o) => s + o.p * Math.max(0, INPUT - o.end),
    0,
  )
}

export function computeLossAversion(answers: Answer[]): number {
  let weightedTol = 0
  let weightSum = 0
  for (const { round, allocX } of answers) {
    if (LAMBDA_EXCLUDED_TAGS.has(round.tag)) continue
    const esX = expectedShortfall(round, 100) // all-Growth standalone shortfall
    const esY = expectedShortfall(round, 0) // all-Anchor standalone shortfall
    const gap = Math.abs(esX - esY)
    if (gap < 1) continue // both sides equally safe: no loss-aversion signal
    // Weight-implied shortfall the player signed up for, normalized between the
    // safer side (0) and the riskier side (1). Linear in the split by design.
    const p = allocX / 100
    const lo = Math.min(esX, esY)
    const hi = Math.max(esX, esY)
    const tol = clamp((p * esX + (1 - p) * esY - lo) / (hi - lo), 0, 1)
    // Weight by the dollar shortfall gap so rounds with a bigger downside
    // decision count for more.
    weightedTol += tol * gap
    weightSum += gap
  }
  if (weightSum === 0) return 0
  return clamp(1 - 2 * (weightedTol / weightSum), -1, 1) // high = loss-averse
}

// ---------------------------------------------------------------------------
// Archetype classification
// ---------------------------------------------------------------------------

// The base archetype is decided by payoff SHAPE only — variance, skew, loss
// aversion. EV-discipline is deliberately NOT part of these vectors (every
// shape archetype is ev-neutral). The Optimizer is handled as an ADDITIVE
// overlay on top of the shape result: it isn't a competing direction in the
// same space, it's a separate reading of one axis.
type ShapeScores = { sigma: number; alpha: number; lambda: number }

// Archetypes that compete on payoff SHAPE via cosine similarity. The Quant
// (EV overlay) and the Indexer are both intentionally absent. The Indexer is
// NOT a direction in shape space — its old vector sat ~0.81 collinear with the
// Banker, so the Banker-vs-Indexer result was really decided by magnitude,
// which cosine discards. The Indexer is instead the LOW-CONVICTION outcome
// (see classify): when no shape tilt is strong enough, "own the market" wins.
export type ShapeArchetype = Exclude<ArchetypeKey, 'quant' | 'indexer'>
export const SHAPE_VECTORS: Record<ShapeArchetype, ShapeScores> = {
  banker: { sigma: -0.7, alpha: -0.2, lambda: +0.8 },
  venture: { sigma: +0.6, alpha: +0.9, lambda: -0.5 },
  insurer: { sigma: +0.4, alpha: -0.8, lambda: 0.0 },
}

export function cosineSim(a: ShapeScores, b: ShapeScores): number {
  const dot = a.sigma * b.sigma + a.alpha * b.alpha + a.lambda * b.lambda
  const magA = Math.sqrt(a.sigma ** 2 + a.alpha ** 2 + a.lambda ** 2)
  const magB = Math.sqrt(b.sigma ** 2 + b.alpha ** 2 + b.lambda ** 2)
  return magA && magB ? dot / (magA * magB) : 0
}

export type Classification = {
  archetype: ArchetypeKey
  secondary: ArchetypeKey | null
  primarySim: number
  secondarySim: number | null
  isBlend: boolean
  confidence: number // 0..1 — how trustworthy the call is (conviction + separation)
  tentative: boolean // true when confidence is low enough to caveat the result
}

// Below this shape magnitude there's no real shape tilt — the result is the
// Indexer ("own the market"), unless EV-discipline is strong enough to make it
// a pure Quant.
const SHAPE_MIN = 0.3
// EV-discipline strong enough to surface the Quant overlay. Set above the noise
// floor so "+ Quant" means a genuinely EV-disciplined player, not someone who
// chased the richer side once or twice. (See scripts/coverage.ts.)
const EV_TAG = 0.45
// Confidence calibration: a shape tilt of this magnitude — and a top-2 cosine
// margin of this size — each count as fully convincing on their own.
const CONVICTION_FULL = 0.6
const MARGIN_FULL = 0.25
// Below this composite confidence the result is flagged tentative.
const TENTATIVE_BELOW = 0.4

export function classify(scores: { sigma: number; alpha: number; lambda: number; ev: number }): Classification {
  const shape: ShapeScores = { sigma: scores.sigma, alpha: scores.alpha, lambda: scores.lambda }
  const shapeMag = Math.sqrt(shape.sigma ** 2 + shape.alpha ** 2 + shape.lambda ** 2)
  const evStrong = scores.ev >= EV_TAG
  // The Quant "match" is read straight off the EV axis (0..1).
  const evSim = clamp(scores.ev, 0, 1)

  // No meaningful shape tilt: low conviction. Strong EV-discipline => a pure
  // Quant; otherwise the Indexer. The closer to dead-center, the more confidently
  // "balanced"; a near-threshold tilt is a borderline call, so flag it tentative.
  if (shapeMag < SHAPE_MIN) {
    if (evStrong) {
      return {
        archetype: 'quant', secondary: null, primarySim: evSim, secondarySim: null,
        isBlend: false, confidence: evSim, tentative: evSim < 0.5,
      }
    }
    const confidence = clamp(1 - shapeMag / SHAPE_MIN, 0, 1)
    return {
      archetype: 'indexer', secondary: null, primarySim: 0, secondarySim: null,
      isBlend: false, confidence, tentative: confidence < TENTATIVE_BELOW,
    }
  }

  const sims = (Object.keys(SHAPE_VECTORS) as ShapeArchetype[])
    .map((key) => ({ key, sim: cosineSim(shape, SHAPE_VECTORS[key]) }))
    .sort((a, b) => b.sim - a.sim)
  const primary = sims[0]
  const margin = primary.sim - sims[1].sim

  // Confidence = how strongly the player tilted (conviction) and how clearly one
  // archetype won (separation).
  const conviction = clamp(shapeMag / CONVICTION_FULL, 0, 1)
  const separation = clamp(margin / MARGIN_FULL, 0, 1)
  const confidence = 0.6 * conviction + 0.4 * separation
  const tentative = confidence < TENTATIVE_BELOW

  // The Quant rides on top additively when EV-discipline is strong; otherwise the
  // runner-up shape archetype fills the secondary slot (a blend when it's close).
  if (evStrong) {
    return {
      archetype: primary.key, secondary: 'quant', primarySim: primary.sim,
      secondarySim: evSim, isBlend: true, confidence, tentative,
    }
  }
  return {
    archetype: primary.key, secondary: sims[1].key, primarySim: primary.sim,
    secondarySim: sims[1].sim, isBlend: margin < 0.15, confidence, tentative,
  }
}

// ---------------------------------------------------------------------------
// Asset-class allocation engine
// ---------------------------------------------------------------------------

// Asset-class allocation is driven by payoff shape only (σ, α, λ); the ev axis
// describes how the client decides, not what an asset class is.
type ShapeVector = { sigma: number; alpha: number; lambda: number }

export const ASSET_CLASS_LOADINGS: Record<AssetClass, ShapeVector> = {
  'Fixed income': { sigma: -0.333, alpha: -0.267, lambda: +0.283 },
  Equities: { sigma: +0.371, alpha: +0.171, lambda: -0.193 },
  'Income structures': { sigma: -0.1, alpha: -0.64, lambda: -0.2 },
  'Growth structures': { sigma: -0.05, alpha: +0.8, lambda: +0.2 },
  Alternatives: { sigma: +0.14, alpha: -0.32, lambda: 0.0 },
  Crypto: { sigma: +0.9, alpha: +0.8, lambda: -0.8 },
  'Cash/MMF': { sigma: -0.8, alpha: 0.0, lambda: +0.7 },
}

// Per-archetype hard caps prevent degenerate outcomes
const ALLOC_CAPS: Record<string, Partial<Record<AssetClass, number>>> = {
  banker: { Crypto: 0.0, 'Income structures': 0.12, 'Growth structures': 0.15 },
  quant: { Crypto: 0.08 },
  venture: { 'Income structures': 0.06, 'Cash/MMF': 0.05 },
  insurer: { Crypto: 0.05, 'Growth structures': 0.06, 'Cash/MMF': 0.05 },
  indexer: { Crypto: 0.0, 'Income structures': 0.06, 'Growth structures': 0.06 },
}

function vecDistance(a: ShapeVector, b: ShapeVector): number {
  return Math.sqrt((a.sigma - b.sigma) ** 2 + (a.alpha - b.alpha) ** 2 + (a.lambda - b.lambda) ** 2)
}

// Affinity temperature for the softmax in step 1. Lower = sharper (allocations
// concentrate in the closest-fitting classes); higher = flatter (allocations
// spread evenly regardless of profile). 0.5 gives a moderate tilt: the
// closest-fitting classes lead while keeping a sensibly diversified spread
// across the rest. This is the one knob to tune the overall conviction of the
// allocation engine.
export const ALLOC_TEMPERATURE = 0.5

// "Core" asset classes that may take large allocations. Everything else is a
// satellite sleeve that gets held down (see SATELLITE_PENALTY).
const CORE_CLASSES = new Set<AssetClass>(['Fixed income', 'Equities'])

// Satellite-sleeve penalty strength. After the softmax, every non-core class's
// weight w is passed through a saturating map w / (1 + k·w): small sleeves pass
// through nearly unchanged, but large sleeves are damped progressively harder,
// so the bigger a satellite allocation would be, the more it's penalized. The
// freed weight flows to the core classes on renormalization. Higher k = more
// core-heavy portfolios. 0 disables the penalty.
export const SATELLITE_PENALTY = 10

export function computeAllocation(
  archetype: string,
  scores: { sigma: number; alpha: number; lambda: number },
): { assetClass: AssetClass; pct: number }[] {
  // The Quant has no payoff-shape preference (σ=α=λ≈0), so the distance engine
  // would hand back a flat, characterless spread. A disciplined EV-maximizer is
  // better expressed as a concentrated, low-cost equity book with a small
  // high-expected-return satellite — fix it at 90% equities / 10% crypto.
  if (archetype === 'quant') {
    return [
      { assetClass: 'Equities', pct: 90 },
      { assetClass: 'Crypto', pct: 10 },
    ]
  }

  const target = { sigma: scores.sigma, alpha: scores.alpha, lambda: scores.lambda }
  const classes = Object.keys(ASSET_CLASS_LOADINGS) as AssetClass[]
  const caps = ALLOC_CAPS[archetype] ?? {}

  // Step 1: softmax affinity toward each asset class. Weight ∝ exp(-d / T),
  // where d is the distance from the client's profile to the class loading and
  // T is the temperature. This rewards proximity far more sharply than the old
  // 1/(1+d) kernel (which compressed every class into a similar share, making
  // all profiles look alike); the closest classes now dominate. Result sums to 1.
  const exps: Record<string, number> = {}
  for (const cls of classes) {
    const d = vecDistance(ASSET_CLASS_LOADINGS[cls], target)
    exps[cls] = Math.exp(-d / ALLOC_TEMPERATURE)
  }
  const expTotal = Object.values(exps).reduce((s, v) => s + v, 0) || 1
  const raw: Record<string, number> = {}
  for (const cls of classes) raw[cls] = exps[cls] / expTotal

  // Step 1b: satellite-sleeve penalty. Non-core classes (everything but Fixed
  // income and Equities) pass through a saturating map w / (1 + k·w), so larger
  // would-be satellite allocations are damped progressively harder. The core
  // classes keep their full weight and absorb the freed share on renormalization.
  for (const cls of classes) {
    if (!CORE_CLASSES.has(cls)) raw[cls] = raw[cls] / (1 + SATELLITE_PENALTY * raw[cls])
  }

  // Step 2: apply archetype caps plus global 60% cap
  const capped: Record<string, number> = {}
  for (const cls of classes) {
    const cap = caps[cls] !== undefined ? caps[cls]! : 0.6
    capped[cls] = Math.min(cap, raw[cls])
  }

  // Step 4: renormalize
  const total = Object.values(capped).reduce((s, v) => s + v, 0)
  const norm: Record<string, number> = {}
  for (const cls of classes) norm[cls] = total > 0 ? capped[cls] / total : 0

  // Step 5: largest-remainder rounding to integers summing to 100
  const rawPcts: Record<string, number> = {}
  for (const cls of classes) rawPcts[cls] = norm[cls] * 100

  const floored: Record<string, number> = {}
  for (const cls of classes) floored[cls] = Math.floor(rawPcts[cls])

  const remainder = 100 - Object.values(floored).reduce((s, v) => s + v, 0)
  const sorted = classes
    .slice()
    .sort((a, b) => rawPcts[b] - floored[b] - (rawPcts[a] - floored[a]))
  for (let i = 0; i < remainder; i++) floored[sorted[i]]++

  return classes
    .filter((cls) => floored[cls] > 0)
    .map((cls) => ({ assetClass: cls as AssetClass, pct: floored[cls] }))
    .sort((a, b) => b.pct - a.pct)
}

// ---------------------------------------------------------------------------
// Instrument fit scoring
// ---------------------------------------------------------------------------

export function computeFitScore(
  instrument: Instrument,
  scores: { sigma: number; alpha: number; lambda: number },
): number {
  // Fit: proximity in (sigma, alpha, lambda) space
  const sigmaMatch = 1 - Math.abs(scores.sigma - instrument.sigmaLoad) / 2
  const alphaMatch = 1 - Math.abs(scores.alpha - instrument.alphaLoad) / 2
  const lambdaMatch = 1 - Math.abs(scores.lambda - instrument.lambdaLoad) / 2

  // Alpha weighted highest — skew preference is the most differentiating axis
  const coreFit = (sigmaMatch * 0.3 + alphaMatch * 0.45 + lambdaMatch * 0.25) * 100

  return Math.round(Math.max(0, Math.min(100, coreFit)))
}

export function getRankedInstruments(scores: {
  sigma: number
  alpha: number
  lambda: number
}): (Instrument & { fit: number })[] {
  return INSTRUMENTS.map((inst) => ({ ...inst, fit: computeFitScore(inst, scores) }))
    .filter((inst) => inst.fit >= 25)
    .sort((a, b) => b.fit - a.fit)
    .slice(0, 12)
}

// ---------------------------------------------------------------------------
// Dashboard data assembly
// ---------------------------------------------------------------------------

export interface DashboardData {
  archetype: ArchetypeKey
  secondaryArchetype: ArchetypeKey | null
  isBlend: boolean
  primarySimilarity: number
  secondarySimilarity: number | null
  confidence: number
  tentative: boolean
  scores: NormalizedScores
}

export function buildDashboardData(
  normalized: NormalizedScores,
  answers: Answer[],
): DashboardData {
  // Fill in λ from realized downside (the normalized λ is a placeholder).
  const scores: NormalizedScores = { ...normalized, lambda: computeLossAversion(answers) }
  const c = classify(scores)
  return {
    archetype: c.archetype,
    secondaryArchetype: c.secondary,
    isBlend: c.isBlend,
    primarySimilarity: c.primarySim,
    secondarySimilarity: c.secondarySim,
    confidence: c.confidence,
    tentative: c.tentative,
    scores,
  }
}
