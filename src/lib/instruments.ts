import type { RiskLevel } from './scoring'

export type AssetClass =
  | 'Fixed income'
  | 'Equities'
  // Structured products, split by payoff into Phoenix (carry / negative skew)
  // and Participation notes (convex / positive skew) — see GLOBAL_SUBCLASSES.
  | 'Structured notes'

// ---------------------------------------------------------------------------
// Region: global (international markets) vs local (Paraguayan / Cadiem menu)
// ---------------------------------------------------------------------------
// Every instrument belongs to exactly one region. The two are classified and
// allocated independently — the advisor dashboard shows a Global portfolio AND
// a Local portfolio. Global instruments are organized by the AssetClass classes
// above; local ones by the LocalCategory set below.
export type Region = 'global' | 'local'

export type LocalCategory =
  | 'Equities'
  | 'Fixed income'
  | 'CDs'
  | 'Mutual funds'
  | 'Investment funds'

// A category is region-specific: an AssetClass for global, a LocalCategory for
// local. 'Equities' and 'Fixed income' exist in both, so the region always
// disambiguates which taxonomy (and palette) applies.
export type Category = AssetClass | LocalCategory

export interface Instrument {
  name: string
  ticker: string
  region?: Region // defaults to 'global' when absent
  assetClass: Category
  kind?: string // specific instrument type within the class (Bond, CDA, Preferred stock, ETF…)
  // Risk is a 1–5 LEVEL, derived live from class + credit rating + market vol via
  // the admin rules (lib/riskLevels). Only an explicit admin override is stored.
  riskLevelOverride?: RiskLevel
  liquidityTier: 1 | 2 | 3 | 4
  lockupMonths: number
}

export const ASSET_CLASSES: AssetClass[] = ['Fixed income', 'Equities', 'Structured notes']

export const LOCAL_CATEGORIES: LocalCategory[] = [
  'Fixed income',
  'Equities',
  'CDs',
  'Mutual funds',
  'Investment funds',
]

export const ASSET_CLASS_COLORS: Record<AssetClass, string> = {
  'Fixed income': '#378ADD',
  Equities: '#00C9A7',
  'Structured notes': '#9B59B6',
}

export const LOCAL_CATEGORY_COLORS: Record<LocalCategory, string> = {
  'Fixed income': '#378ADD',
  Equities: '#00C9A7',
  CDs: '#8A8D99',
  'Mutual funds': '#C9933A',
  'Investment funds': '#9B59B6',
}

const LOCAL_CATEGORY_SET = new Set<string>(LOCAL_CATEGORIES)
export function isLocalCategory(c: string): c is LocalCategory {
  return LOCAL_CATEGORY_SET.has(c)
}

/** The categories that make up a region's taxonomy. */
export function categoriesForRegion(region: Region): Category[] {
  return region === 'local' ? LOCAL_CATEGORIES : ASSET_CLASSES
}

/** Swatch color for a category, using the right palette for the region. */
export function colorForCategory(category: Category, region: Region = 'global'): string {
  if (region === 'local') return LOCAL_CATEGORY_COLORS[category as LocalCategory] ?? '#8A8D99'
  return ASSET_CLASS_COLORS[category as AssetClass] ?? '#8A8D99'
}

// Field derivation (documentation only):
//  riskLevelOverride: an admin exception to the derived 1–5 level. When unset,
//    the level is derived live from asset class + credit rating + market vol via
//    the admin rules (lib/riskLevels.ts). Set it only for hand-tuned exceptions
//    (e.g. structured notes, whose payoff skew a class+rating rule can't express).
//  liquidityTier: 1 intraday, 2 secondary market, 3 monthly, 4 locked/OTC
//  lockupMonths: 0 tradeable, 12 for 1-year structures, 36 for 3-year
//
// BARE-BONES EXAMPLE UNIVERSE
// ---------------------------
// A deliberately small, representative default set (a few instruments per asset
// class) — every entry ships with a detail sheet in data/instrumentDetails.ts.
// This seeds the admin-managed catalog (lib/catalog.tsx); admins add, edit, hide,
