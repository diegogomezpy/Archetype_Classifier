import {
  type AssetClass,
  type Category,
  type Instrument,
  type LocalCategory,
  type Region,
} from './instruments'

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

// ---------------------------------------------------------------------------
// The two-axis profile
// ---------------------------------------------------------------------------
// A client is placed on exactly two axes, both in [-1, 1]:
//   riskAversion  +1 = protects capital, avoids volatility · −1 = seeks upside
//   liquidity     +1 = wants ready access to cash · −1 = can lock capital away
// The scores come from an admin-authored questionnaire (see lib/questionnaire),
// NOT from any fixed instrument-level model — the risk model is the client's
// answers alone.
export type AxisScores = {
  riskAversion: number
  liquidity: number
}

export const EMPTY_SCORES: AxisScores = { riskAversion: 0, liquidity: 0 }

// A stored session may predate this model (old {sigma,alpha,lambda,ev} shape),
// so coerce anything missing to a neutral 0 rather than crashing the dashboard.
function coerce(scores: Partial<AxisScores> | null | undefined): AxisScores {
  return {
    riskAversion: clamp(Number(scores?.riskAversion) || 0, -1, 1),
    liquidity: clamp(Number(scores?.liquidity) || 0, -1, 1),
  }
}

// ---------------------------------------------------------------------------
// Risk bands (the classification)
// ---------------------------------------------------------------------------
// The profile reduces to a fixed 1–5 risk band, driven by the risk-aversion
// axis alone. Nivel 1 = most conservative (highest aversion) … Nivel 5 = most
// aggressive. The liquidity axis does NOT move the band — it's a lever the
// advisor's within-class optimizer uses to prefer liquid vs locked-up holdings.
export const RISK_LEVELS = [1, 2, 3, 4, 5] as const
export type RiskLevel = (typeof RISK_LEVELS)[number]

// Thresholds on riskAversion. Kept alongside the level so the admin editor can
// show each band's range. Ordered most-conservative first.
export const BAND_THRESHOLDS: { level: RiskLevel; min: number; max: number }[] = [
  { level: 1, min: 0.6, max: 1 },
  { level: 2, min: 0.2, max: 0.6 },
  { level: 3, min: -0.2, max: 0.2 },
  { level: 4, min: -0.6, max: -0.2 },
  { level: 5, min: -1, max: -0.6 },
]

export function riskLevelFor(scores: Partial<AxisScores>): RiskLevel {
  const ra = coerce(scores).riskAversion
  if (ra >= 0.6) return 1
  if (ra >= 0.2) return 2
  if (ra >= -0.2) return 3
  if (ra >= -0.6) return 4
  return 5
}

// ---------------------------------------------------------------------------
// Asset-class allocation engine
// ---------------------------------------------------------------------------
// The model portfolio is DERIVED from the two axes: a more risk-averse client
// tilts to fixed income, a more risk-tolerant one to equities; a stronger
// liquidity preference pulls toward liquid classes and away from locked-up
// satellites. Used to seed each band's preset mix; the admin can override it.

// Raw (non-negative) class weights as a function of the profile, per region.
function rawWeights(v: AxisScores, region: Region): { cls: Category; w: number }[] {
  const r = (clamp(v.riskAversion, -1, 1) + 1) / 2 // 0 tolerant … 1 averse
  const l = (clamp(v.liquidity, -1, 1) + 1) / 2 // 0 lock-up ok … 1 needs liquidity
  const liqTilt = (l - 0.5) * 2 // −1 … +1

  if (region === 'local') {
    const rows: { cls: LocalCategory; w: number }[] = [
      { cls: 'CDs', w: 0.08 + 0.34 * r + 0.16 * l },
      { cls: 'Fixed income', w: 0.12 + 0.3 * r + 0.1 * l },
      { cls: 'Mutual funds', w: 0.14 + 0.06 * (1 - r) },
      { cls: 'Equities', w: 0.08 + 0.42 * (1 - r) },
      { cls: 'Investment funds', w: 0.1 + 0.3 * (1 - r) - 0.14 * liqTilt },
    ]
    return rows.map((x) => ({ cls: x.cls as Category, w: Math.max(0, x.w) }))
  }

  const rows: { cls: AssetClass; w: number }[] = [
    { cls: 'Fixed income', w: 0.15 + 0.55 * r + 0.28 * l },
    { cls: 'Equities', w: 0.15 + 0.7 * (1 - r) },
    { cls: 'Structured notes', w: 0.14 + 0.14 * (1 - r) - 0.18 * liqTilt },
  ]
  return rows.map((x) => ({ cls: x.cls as Category, w: Math.max(0, x.w) }))
}

export function computeAllocation(
  vector: AxisScores,
  region: Region = 'global',
): { assetClass: Category; pct: number }[] {
  const weights = rawWeights(vector, region)
  const sum = weights.reduce((s, w) => s + w.w, 0) || 1

  // Normalize, then a uniform 60% cap per class so a lopsided profile can't hand
  // back a single-class portfolio (the admin can still hand-edit past this).
  let frac = weights.map((w) => ({ cls: w.cls, p: Math.min(0.6, w.w / sum) }))
  const capSum = frac.reduce((s, w) => s + w.p, 0) || 1
  frac = frac.map((w) => ({ cls: w.cls, p: w.p / capSum }))

  // Largest-remainder rounding to integers summing to 100.
  const rows = frac.map((w) => ({ cls: w.cls, raw: w.p * 100, pct: Math.floor(w.p * 100) }))
  const remainder = 100 - rows.reduce((s, w) => s + w.pct, 0)
  rows.sort((a, b) => b.raw - Math.floor(b.raw) - (a.raw - Math.floor(a.raw)))
  for (let i = 0; i < remainder && rows.length > 0; i++) rows[i % rows.length].pct++

  return rows
    .filter((w) => w.pct > 0)
    .map((w) => ({ assetClass: w.cls, pct: w.pct }))
    .sort((a, b) => b.pct - a.pct)
}

// ---------------------------------------------------------------------------
// Instrument fit scoring
// ---------------------------------------------------------------------------
// Fit blends how close the instrument's assigned 1–5 risk LEVEL is to the
// client's band (the primary term) with how well its liquidity tier matches the
// client's liquidity preference. The instrument's level is resolved upstream
// (lib/portfolio → assignedLevel) and passed in, keeping this module free of any
// catalog/portfolio dependency.
export function computeFitScore(
  instrument: Instrument,
  scores: AxisScores,
  instrumentLevel: RiskLevel,
): number {
  const clientLevel = riskLevelFor(scores)
  const riskMatch = 1 - Math.abs(instrumentLevel - clientLevel) / 4 // levels 1..5 → 0..1

  const instLiq = clamp(1 - (instrument.liquidityTier - 1) * (2 / 3), -1, 1)
  const liqMatch = 1 - Math.abs(scores.liquidity - instLiq) / 2

  // Risk level is the primary axis, so weight it above liquidity.
  const fit = (riskMatch * 0.65 + liqMatch * 0.35) * 100
  return Math.round(Math.max(0, Math.min(100, fit)))
}

// ---------------------------------------------------------------------------
// Dashboard data assembly
// ---------------------------------------------------------------------------

export interface DashboardData {
  level: RiskLevel
  scores: AxisScores
}

// Re-derive a session's band from its stored SCORES. Scores are band-independent
// (they come from the client's answers), so a saved session always reflects the
// CURRENT thresholds + presets when re-derived this way — the advisor view never
// shows a stale call.
export function reclassifyScores(scores: Partial<AxisScores>): DashboardData {
  const point = coerce(scores)
  return { level: riskLevelFor(point), scores: point }
}
