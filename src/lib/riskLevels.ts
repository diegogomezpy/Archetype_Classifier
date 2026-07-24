import type { AssetClass, Category, LocalCategory, Region } from './instruments'
import type { RiskLevel } from './scoring'

// ---------------------------------------------------------------------------
// Risk-level derivation (replaces the old σ/α/λ vectors)
// ---------------------------------------------------------------------------
// Every instrument gets a 1–5 risk level. It is DERIVED live from what the
// catalog publishes — the asset class, the credit rating, and (when available)
// the instrument's market-implied volatility — using admin-editable rules, with
// a per-instrument override for exceptions. Nothing is persisted on the
// instrument except the optional override, so a rules edit re-levels everything.

const clampLevel = (n: number): RiskLevel => Math.max(1, Math.min(5, Math.round(n))) as RiskLevel

// Normalize a rating to an S&P-style key: strip local "py"/"f" markers
// (AAApy → AAA, AAf-py → AA-), uppercase, keep letter + sign only.
export function normalizeRating(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/PY/g, '')
    .replace(/F/g, '')
    .replace(/[^A-Z+\-]/g, '')
}

export type RiskLevelParams = {
  /** Global asset-class default level. */
  baseLevel: Record<AssetClass, RiskLevel>
  /** Local-category default level (Equities/Fixed income exist in both regions). */
  localBaseLevel: Record<LocalCategory, RiskLevel>
  /** normalizeRating key → integer level delta (longest matching key wins). */
  ratingAdjust: Record<string, number>
  /** Ascending vol ladder: first threshold with vol ≤ maxVol wins. */
  volThresholds: { maxVol: number; level: RiskLevel }[]
}

export const RISK_LEVEL_PARAMS: RiskLevelParams = {
  baseLevel: {
    'Fixed income': 2,
    Equities: 3,
    'Structured notes': 4,
  },
  localBaseLevel: {
    'Fixed income': 2,
    Equities: 3,
    CDs: 1,
    'Mutual funds': 2,
    'Investment funds': 4,
  },
  // Credit quality nudges a bond's level up (riskier) or down (safer).
  ratingAdjust: {
    AAA: -1, 'AA+': -1, AA: -1, 'AA-': 0,
    'A+': 0, A: 0, 'A-': 0,
    'BBB+': 1, BBB: 1, 'BBB-': 1,
    'BB+': 2, BB: 2, 'BB-': 2,
    'B+': 2, B: 3, 'B-': 3,
    CCC: 3, CC: 4, C: 4, D: 4,
  },
  // Mirrors the aggregate riskBucket ladder.
  volThresholds: [
    { maxVol: 0.04, level: 1 },
    { maxVol: 0.08, level: 2 },
    { maxVol: 0.13, level: 3 },
    { maxVol: 0.2, level: 4 },
    { maxVol: Infinity, level: 5 },
  ],
}

let ACTIVE: RiskLevelParams = RISK_LEVEL_PARAMS
export const setActiveRiskLevels = (p: RiskLevelParams): void => {
  ACTIVE = p
}
export const getActiveRiskLevels = (): RiskLevelParams => ACTIVE

// Rating → level delta. Only applies to instruments that carry a rating; an
// absent rating contributes 0 (equities/funds are legitimately unrated and must
// not be penalized).
function ratingDelta(rating: string | undefined, params: RiskLevelParams): number {
  if (!rating || !rating.trim()) return 0
  const s = normalizeRating(rating)
  const keys = Object.keys(params.ratingAdjust).sort((a, b) => b.length - a.length)
  const hit = keys.find((k) => s.startsWith(normalizeRating(k)))
  return hit ? params.ratingAdjust[hit] : 0
}

function levelFromVol(vol: number, params: RiskLevelParams): RiskLevel {
  const hit = params.volThresholds.find((t) => vol <= t.maxVol)
  return hit ? hit.level : 5
}

/**
 * The 1–5 risk level for an instrument, from its class + credit rating (+ market
 * vol when present). Rating/base give a floor; a higher vol-implied level wins —
 * so a volatile name never reads as safe, but a calm bond keeps its low level.
 * `marketVol` must be the un-fallbacked market vol (undefined ⇒ class+rating
 * only) to avoid a vol⇄level circularity.
 */
export function deriveRiskLevel(
  region: Region,
  assetClass: Category,
  creditRating?: string,
  marketVol?: number,
  params: RiskLevelParams = ACTIVE,
): RiskLevel {
  const base =
    region === 'local'
      ? params.localBaseLevel[assetClass as LocalCategory] ?? 3
      : params.baseLevel[assetClass as AssetClass] ?? 3
  let level = base + ratingDelta(creditRating, params)
  if (marketVol != null && Number.isFinite(marketVol)) {
    level = Math.max(level, levelFromVol(marketVol, params))
  }
  return clampLevel(level)
}

// Representative annualized volatility for a level — the fallback used when an
// instrument carries no market-implied vol of its own.
const LEVEL_VOL: Record<RiskLevel, number> = { 1: 0.03, 2: 0.06, 3: 0.1, 4: 0.16, 5: 0.25 }
export function volFromLevel(level: RiskLevel): number {
  return LEVEL_VOL[level]
}
