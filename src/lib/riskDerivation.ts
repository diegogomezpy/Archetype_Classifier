import type { AssetClass, Category, LocalCategory, Region } from './instruments'

// ---------------------------------------------------------------------------
// Risk-vector auto-derivation
// ---------------------------------------------------------------------------
// A security's σ/α/λ (variance / skew / loss-aversion) drives classification and
// instrument fit, but a Bloomberg export or the Cadiem bulletin never carries
// those numbers. So we DERIVE them from the fields that ARE published — the
// asset class, the credit rating, and (for equities) beta.
//
// Every coefficient lives in RISK_PARAMS below so the logic is auditable in one
// place; it's also the shape that the admin editor persists and tweaks. Both the
// bundled local menu and the file importers call deriveRiskVector(), so tuning
// the params retunes everything uniformly.

type V3 = { s: number; a: number; l: number }

export type RiskParams = {
  /** Credit rating → risk factor r ∈ [0,1] (0 = safest, 1 = riskiest). */
  ratingRisk: Record<string, number>
  /** Local category → base vector + how strongly the credit-risk factor shifts it. */
  local: Record<LocalCategory, { base: V3; byRating: V3 }>
  /** Global asset class → base vector (mirrors the scoring engine's loadings). */
  global: Record<AssetClass, V3>
  /** Equity σ shifts by (beta − 1) × this. */
  equityBetaSensitivity: number
}

export const RISK_PARAMS: RiskParams = {
  ratingRisk: {
    AAA: 0.0,
    'AA+': 0.1, AA: 0.15, 'AA-': 0.2,
    'A+': 0.3, A: 0.38, 'A-': 0.42,
    'BBB+': 0.55, BBB: 0.62, 'BBB-': 0.68,
    'BB+': 0.8, BB: 0.85, 'BB-': 0.88,
    'B+': 0.92, B: 0.94, 'B-': 0.96,
    CCC: 0.99,
  },
  local: {
    // riskier credit ⇒ more variance, deeper negative skew, less loss-averse
    'Fixed income': { base: { s: -0.35, a: -0.35, l: 0.45 }, byRating: { s: 0.6, a: -0.25, l: -0.85 } },
    CDs: { base: { s: -0.75, a: 0, l: 0.7 }, byRating: { s: 0.3, a: 0, l: -0.4 } },
    'Mutual funds': { base: { s: -0.5, a: 0, l: 0.5 }, byRating: { s: 0.35, a: 0, l: -0.4 } },
    'Investment funds': { base: { s: 0.1, a: 0.2, l: 0.15 }, byRating: { s: 0, a: 0, l: 0 } },
    Equities: { base: { s: 0.4, a: 0, l: -0.2 }, byRating: { s: 0, a: 0, l: 0 } },
  },
  global: {
    'Fixed income': { s: -0.33, a: -0.27, l: 0.28 },
    Equities: { s: 0.37, a: 0.17, l: -0.19 },
    'Income structures': { s: -0.1, a: -0.64, l: -0.2 },
    'Growth structures': { s: -0.05, a: 0.8, l: 0.2 },
    Alternatives: { s: 0.14, a: -0.32, l: 0 },
    Crypto: { s: 0.9, a: 0.8, l: -0.8 },
    'Cash/MMF': { s: -0.8, a: 0, l: 0.7 },
  },
  equityBetaSensitivity: 0.4,
}

// The params the derivation actually uses. Defaults to the built-ins; the admin
// "Risk model" editor overrides them at runtime (and persists to Firestore), so
// tuning retunes every import + re-seed uniformly.
let ACTIVE: RiskParams = RISK_PARAMS
export const setActiveRiskParams = (p: RiskParams): void => {
  ACTIVE = p
}
export const getActiveRiskParams = (): RiskParams => ACTIVE

const clamp1 = (n: number) => Math.max(-1, Math.min(1, Math.round(n * 100) / 100))

const numOr = (v: string | undefined): number | null => {
  if (v == null) return null
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''))
  return Number.isFinite(n) ? n : null
}

// Normalize a rating string to an S&P-style key: strip the local "py"/"f" markers
// (AAApy → AAA, AAf-py → AA-), uppercase, keep only the letter + sign.
export function normalizeRating(raw: string): string {
  const s = raw
    .toUpperCase()
    .replace(/PY/g, '')
    .replace(/F/g, '')
    .replace(/[^A-Z+\-]/g, '')
  return s
}

export function ratingFactor(rating: string | undefined, params: RiskParams = ACTIVE): number {
  if (!rating || !rating.trim()) return 0.5 // unrated → mid
  const s = normalizeRating(rating)
  const keys = Object.keys(params.ratingRisk).sort((a, b) => b.length - a.length)
  const hit = keys.find((k) => s.startsWith(normalizeRating(k)))
  return hit ? params.ratingRisk[hit] : 0.5
}

/** Derive σ/α/λ for an instrument from its class + published fields. */
export function deriveRiskVector(
  region: Region,
  category: Category,
  details: Record<string, string> = {},
  params: RiskParams = ACTIVE,
): { sigmaLoad: number; alphaLoad: number; lambdaLoad: number } {
  if (region === 'local') {
    const p = params.local[category as LocalCategory]
    if (!p) return { sigmaLoad: 0, alphaLoad: 0, lambdaLoad: 0 }
    const r = ratingFactor(details.rating, params)
    return {
      sigmaLoad: clamp1(p.base.s + p.byRating.s * r),
      alphaLoad: clamp1(p.base.a + p.byRating.a * r),
      lambdaLoad: clamp1(p.base.l + p.byRating.l * r),
    }
  }
  const base = params.global[category as AssetClass] ?? { s: 0, a: 0, l: 0 }
  let s = base.s
  if (category === 'Equities') {
    const beta = numOr(details.beta)
    if (beta != null) s = base.s + (beta - 1) * params.equityBetaSensitivity
  }
  return { sigmaLoad: clamp1(s), alphaLoad: clamp1(base.a), lambdaLoad: clamp1(base.l) }
}

/** Sensible liquidity / lock-up defaults per class (import columns override). */
export function deriveDefaults(
  region: Region,
  category: Category,
): { liquidityTier: 1 | 2 | 3 | 4; lockupMonths: number } {
  if (region === 'local') {
    switch (category as LocalCategory) {
      case 'Fixed income':
        return { liquidityTier: 2, lockupMonths: 0 }
      case 'CDs':
        return { liquidityTier: 3, lockupMonths: 0 }
      case 'Mutual funds':
        return { liquidityTier: 1, lockupMonths: 0 }
      case 'Investment funds':
        return { liquidityTier: 4, lockupMonths: 12 }
      case 'Equities':
        return { liquidityTier: 3, lockupMonths: 0 }
    }
  }
  if (category === 'Income structures' || category === 'Growth structures') {
    return { liquidityTier: 4, lockupMonths: 12 }
  }
  return { liquidityTier: 1, lockupMonths: 0 }
}
