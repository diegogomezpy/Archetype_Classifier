import type { Round, Scores } from '../types'
import type { ArchetypeKey } from '../data/archetypes'
import {
  INSTRUMENTS,
  type AssetClass,
  type Instrument,
} from './instruments'

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

export const EMPTY_SCORES: Scores = { sigma: 0, alpha: 0, lambda: 0, liq: 0 }

/**
 * Per-round scoring contributions for the core dimensions (13-round design).
 * Growth (X) is the aggressive option in every round, so the signal is
 * monotone: s = (allocX - 50) / 50 ∈ [-1, +1]; positive s = leaning aggressive.
 * Weights are signed — a positive weight means more Growth raises that
 * dimension, a negative weight means more Growth lowers it. Aggressive =>
 * higher sigma/alpha, lower lambda, hence the negative lambda weights.
 * Liquidity rounds (7, 10, 11, 12, 13) are handled separately in applyScore.
 */
export const ROUND_SCORES: Record<
  number,
  { dim: 'sigma' | 'alpha' | 'lambda'; weight: number }[]
> = {
  1: [{ dim: 'sigma', weight: 3 }],
  2: [
    { dim: 'sigma', weight: 2 },
    { dim: 'lambda', weight: -1 },
  ],
  3: [{ dim: 'alpha', weight: 3 }],
  4: [
    { dim: 'lambda', weight: -3 },
    { dim: 'sigma', weight: 1 },
  ],
  5: [{ dim: 'alpha', weight: 3 }],
  6: [
    { dim: 'lambda', weight: -3 },
    { dim: 'sigma', weight: 1 },
  ],
  7: [], // liquidity — handled separately
  8: [{ dim: 'alpha', weight: 3 }],
  9: [
    { dim: 'sigma', weight: 2 },
    { dim: 'alpha', weight: 2 },
  ],
  10: [], // liquidity — handled separately
  11: [], // liquidity — handled separately
  12: [], // liquidity — handled separately
  13: [], // liquidity — handled separately
}

// Liquidity rounds and their weights. Picking X (lockup) is liquidity-tolerant.
const LIQ_WEIGHTS: Record<number, number> = { 7: 1.0, 10: 1.0, 11: 1.0, 12: 1.0, 13: 1.0 }

/**
 * Accumulate a round's contribution into the raw score accumulator.
 *
 * Liquidity rounds (type 'liq': 7, 10, 11, 12, 13): binary card pick — X is the
 *   lockup option (RoundScreen passes allocX === 100), Y is the liquid option
 *   (allocX === 0). Picking X (lockup) adds +weight to liq (liquidity-tolerant),
 *   picking Y (liquid) adds -weight.
 * Core rounds: signal scaled by the signed ROUND_SCORES weights.
 */
export function applyScore(acc: Scores, round: Round, allocX: number): Scores {
  const next: Scores = { ...acc }
  const id = round.id

  if (round.type === 'liq') {
    const pickedX = allocX === 100 // X = lockup, Y = liquid
    next.liq += (LIQ_WEIGHTS[id] ?? 0) * (pickedX ? +1 : -1)
    return next
  }

  const signal = (allocX - 50) / 50 // [-1, +1]

  for (const { dim, weight } of ROUND_SCORES[id] ?? []) {
    next[dim] += weight * signal
  }
  return next
}

export type NormalizedScores = {
  sigma: number // [-1, 1] variance tolerance
  alpha: number // [-1, 1] skew preference (positive = seeks positive skew)
  lambda: number // [-1, 1] loss aversion (positive = more loss averse)
  liq: number // [0, 1] liquidity preference (positive = prefers liquidity)
}

// Normalization denominators = sum of |weights| per dimension.
// sigma:  R1(3) + R2(2) + R4(1) + R6(1) + R9(2)        = 9
// alpha:  R3(3) + R5(3) + R8(3) + R9(2)                = 11
// lambda: R2(1) + R4(3) + R6(3)                        = 7
// liq:    R7(1) + R10(1) + R11(1) + R12(1) + R13(1)    = 5
const NORM_SIGMA = 9
const NORM_ALPHA = 11
const NORM_LAMBDA = 7
const NORM_LIQ = 5

export function normalizeScores(raw: Scores): NormalizedScores {
  return {
    sigma: clamp(raw.sigma / NORM_SIGMA, -1, 1),
    alpha: clamp(raw.alpha / NORM_ALPHA, -1, 1),
    lambda: clamp(raw.lambda / NORM_LAMBDA, -1, 1),
    // liq: positive raw = lockup-tolerant = LOW liquidity preference. Negate so
    // a high score = prefers liquidity, then map to [0, 1].
    liq: clamp((-raw.liq / NORM_LIQ + 1) / 2, 0, 1),
  }
}

// ---------------------------------------------------------------------------
// Archetype classification
// ---------------------------------------------------------------------------

type CoreScores = { sigma: number; alpha: number; lambda: number }

export const ARCHETYPE_VECTORS: Record<ArchetypeKey, CoreScores> = {
  protector: { sigma: -0.7, alpha: -0.2, lambda: +0.8 },
  optimizer: { sigma: +0.3, alpha: +0.1, lambda: -0.3 },
  lottery: { sigma: +0.6, alpha: +0.9, lambda: -0.5 },
  carry: { sigma: +0.4, alpha: -0.8, lambda: 0.0 },
  agnostic: { sigma: -0.4, alpha: 0.0, lambda: +0.1 },
}

export function cosineSim(a: CoreScores, b: CoreScores): number {
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
}

export function classify(scores: CoreScores): Classification {
  const sims = (Object.keys(ARCHETYPE_VECTORS) as ArchetypeKey[])
    .map((key) => ({ key, sim: cosineSim(scores, ARCHETYPE_VECTORS[key]) }))
    .sort((a, b) => b.sim - a.sim)

  // No directional signal at all -> default to the Agnostic profile.
  const magnitude = Math.sqrt(scores.sigma ** 2 + scores.alpha ** 2 + scores.lambda ** 2)
  if (magnitude < 1e-6) {
    return { archetype: 'agnostic', secondary: null, primarySim: 0, secondarySim: null, isBlend: false }
  }

  return {
    archetype: sims[0].key,
    secondary: sims[1].key,
    primarySim: sims[0].sim,
    secondarySim: sims[1].sim,
    isBlend: sims[0].sim - sims[1].sim < 0.15,
  }
}

// ---------------------------------------------------------------------------
// Asset-class allocation engine
// ---------------------------------------------------------------------------

export const ASSET_CLASS_LOADINGS: Record<AssetClass, CoreScores> = {
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
  protector: { Crypto: 0.0, 'Income structures': 0.12, 'Growth structures': 0.15 },
  optimizer: { Crypto: 0.08 },
  lottery: { 'Income structures': 0.06, 'Cash/MMF': 0.05 },
  carry: { Crypto: 0.05, 'Growth structures': 0.06, 'Cash/MMF': 0.05 },
  agnostic: { Crypto: 0.0, 'Income structures': 0.06, 'Growth structures': 0.06 },
}

function vecDistance(a: CoreScores, b: CoreScores): number {
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
  scores: { sigma: number; alpha: number; lambda: number; liq: number },
): { assetClass: AssetClass; pct: number }[] {
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

  // Step 3: liquidity penalty — liquidity-preferring clients get less locked-up exposure
  capped['Income structures'] *= 1 - scores.liq * 0.4
  capped['Growth structures'] *= 1 - scores.liq * 0.6

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
  scores: { sigma: number; alpha: number; lambda: number; liq: number },
): number {
  // Core fit: proximity in (sigma, alpha, lambda) space
  const sigmaMatch = 1 - Math.abs(scores.sigma - instrument.sigmaLoad) / 2
  const alphaMatch = 1 - Math.abs(scores.alpha - instrument.alphaLoad) / 2
  const lambdaMatch = 1 - Math.abs(scores.lambda - instrument.lambdaLoad) / 2

  // Alpha weighted highest — skew preference is the most differentiating axis
  const coreFit = (sigmaMatch * 0.3 + alphaMatch * 0.45 + lambdaMatch * 0.25) * 100

  // Liquidity penalties: based on lockup length and liquidity tier
  const lockupPenalty = scores.liq * (instrument.lockupMonths / 36) * 20
  const illiqPenalty = scores.liq * ((instrument.liquidityTier - 1) / 3) * 10

  return Math.round(Math.max(0, Math.min(100, coreFit - lockupPenalty - illiqPenalty)))
}

export function getRankedInstruments(scores: {
  sigma: number
  alpha: number
  lambda: number
  liq: number
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
  scores: NormalizedScores
}

export function buildDashboardData(normalized: NormalizedScores): DashboardData {
  const c = classify({ sigma: normalized.sigma, alpha: normalized.alpha, lambda: normalized.lambda })
  return {
    archetype: c.archetype,
    secondaryArchetype: c.secondary,
    isBlend: c.isBlend,
    primarySimilarity: c.primarySim,
    secondarySimilarity: c.secondarySim,
    scores: normalized,
  }
}
