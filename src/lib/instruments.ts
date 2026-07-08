export type AssetClass =
  | 'Fixed income'
  | 'Equities'
  | 'Income structures' // carry/negative-skew structured products
  | 'Growth structures' // convex/positive-skew structured products
  | 'Alternatives'
  | 'Crypto'
  | 'Cash/MMF'

export interface Instrument {
  name: string
  ticker: string
  assetClass: AssetClass
  sigmaLoad: number
  alphaLoad: number
  lambdaLoad: number
  liquidityTier: 1 | 2 | 3 | 4
  lockupMonths: number
}

export const ASSET_CLASSES: AssetClass[] = [
  'Fixed income',
  'Equities',
  'Income structures',
  'Growth structures',
  'Alternatives',
  'Crypto',
  'Cash/MMF',
]

export const ASSET_CLASS_COLORS: Record<AssetClass, string> = {
  'Fixed income': '#378ADD',
  Equities: '#00C9A7',
  'Income structures': '#C9933A',
  'Growth structures': '#9B59B6',
  Alternatives: '#E67E22',
  Crypto: '#E05C5C',
  'Cash/MMF': '#8A8D99',
}

// Field derivation (documentation only):
//  sigmaLoad: vol tier 1 -> -0.80, 2 -> -0.10, 3 -> +0.50, 4 -> +0.90
//  alphaLoad: negative skew -> -0.80, neutral -> 0.00, positive skew -> +0.80
//  lambdaLoad: loss tier 1 -> +0.70, 2 -> +0.20, 3 -> -0.30, 4 -> -0.80
//  liquidityTier: 1 intraday, 2 secondary market, 3 monthly, 4 locked/OTC
//  lockupMonths: 0 tradeable, 12 for 1-year structures, 36 for 3-year
//
// BARE-BONES EXAMPLE UNIVERSE
// ---------------------------
// A deliberately small, representative default set (a few instruments per asset
// class) — every entry ships with a detail sheet in data/instrumentDetails.ts.
// This seeds the admin-managed catalog (lib/catalog.tsx); admins add, edit, hide,
// and emphasize from here. Illustrative sample content, not investment advice.
export const INSTRUMENTS: Instrument[] = [
  // Fixed income
  { name: 'iShares 1-3yr Treasury Bond ETF', ticker: 'SHY', assetClass: 'Fixed income', sigmaLoad: -0.8, alphaLoad: 0.0, lambdaLoad: +0.7, liquidityTier: 1, lockupMonths: 0 },
  { name: 'iShares 7-10yr Treasury ETF', ticker: 'IEF', assetClass: 'Fixed income', sigmaLoad: -0.1, alphaLoad: 0.0, lambdaLoad: +0.2, liquidityTier: 1, lockupMonths: 0 },
  { name: 'iShares iBoxx HY Corporate Bond ETF', ticker: 'HYG', assetClass: 'Fixed income', sigmaLoad: -0.1, alphaLoad: -0.8, lambdaLoad: -0.3, liquidityTier: 1, lockupMonths: 0 },
  { name: 'BVA Paraguay sovereign bond', ticker: 'OTC', assetClass: 'Fixed income', sigmaLoad: -0.8, alphaLoad: 0.0, lambdaLoad: +0.7, liquidityTier: 2, lockupMonths: 0 },
  { name: 'BVA investment grade corporate', ticker: 'OTC', assetClass: 'Fixed income', sigmaLoad: -0.1, alphaLoad: -0.8, lambdaLoad: +0.2, liquidityTier: 2, lockupMonths: 0 },

  // Equities
  { name: 'Vanguard Total World Stock ETF', ticker: 'VT', assetClass: 'Equities', sigmaLoad: +0.5, alphaLoad: 0.0, lambdaLoad: -0.3, liquidityTier: 1, lockupMonths: 0 },
  { name: 'SPDR S&P 500 ETF', ticker: 'SPY', assetClass: 'Equities', sigmaLoad: +0.5, alphaLoad: 0.0, lambdaLoad: -0.3, liquidityTier: 1, lockupMonths: 0 },
  { name: 'Invesco QQQ (Nasdaq-100)', ticker: 'QQQ', assetClass: 'Equities', sigmaLoad: +0.5, alphaLoad: +0.8, lambdaLoad: -0.3, liquidityTier: 1, lockupMonths: 0 },
  { name: 'iShares MSCI USA Min Vol Factor ETF', ticker: 'USMV', assetClass: 'Equities', sigmaLoad: -0.1, alphaLoad: 0.0, lambdaLoad: +0.2, liquidityTier: 1, lockupMonths: 0 },
  { name: 'NVIDIA Corp', ticker: 'NVDA', assetClass: 'Equities', sigmaLoad: +0.9, alphaLoad: +0.8, lambdaLoad: -0.3, liquidityTier: 1, lockupMonths: 0 },
  { name: 'Walmart Inc', ticker: 'WMT', assetClass: 'Equities', sigmaLoad: -0.1, alphaLoad: 0.0, lambdaLoad: +0.2, liquidityTier: 1, lockupMonths: 0 },

  // Income structures — carry / negative skew
  { name: 'Phoenix autocallable (monthly obs.)', ticker: 'OTC', assetClass: 'Income structures', sigmaLoad: -0.1, alphaLoad: -0.8, lambdaLoad: -0.3, liquidityTier: 4, lockupMonths: 12 },
  { name: 'Reverse convertible (barrier)', ticker: 'OTC', assetClass: 'Income structures', sigmaLoad: -0.1, alphaLoad: -0.8, lambdaLoad: -0.8, liquidityTier: 4, lockupMonths: 12 },
  { name: 'Global X S&P 500 Covered Call ETF', ticker: 'XYLD', assetClass: 'Income structures', sigmaLoad: -0.1, alphaLoad: -0.8, lambdaLoad: +0.2, liquidityTier: 1, lockupMonths: 0 },

  // Growth structures — convex / positive skew
  { name: 'Capital-protected note + participation', ticker: 'OTC', assetClass: 'Growth structures', sigmaLoad: -0.8, alphaLoad: +0.8, lambdaLoad: +0.7, liquidityTier: 4, lockupMonths: 12 },
  { name: 'Uncapped participation note', ticker: 'OTC', assetClass: 'Growth structures', sigmaLoad: +0.5, alphaLoad: +0.8, lambdaLoad: +0.2, liquidityTier: 4, lockupMonths: 12 },
  { name: 'S&P 500 LEAP call options', ticker: 'Listed', assetClass: 'Growth structures', sigmaLoad: +0.9, alphaLoad: +0.8, lambdaLoad: -0.8, liquidityTier: 1, lockupMonths: 0 },

  // Alternatives
  { name: 'iShares Gold Trust', ticker: 'IAU', assetClass: 'Alternatives', sigmaLoad: -0.1, alphaLoad: 0.0, lambdaLoad: +0.2, liquidityTier: 1, lockupMonths: 0 },
  { name: 'iShares Global REIT ETF', ticker: 'REET', assetClass: 'Alternatives', sigmaLoad: +0.5, alphaLoad: -0.8, lambdaLoad: -0.3, liquidityTier: 1, lockupMonths: 0 },
  { name: 'iMGP DBi Managed Futures ETF', ticker: 'DBMF', assetClass: 'Alternatives', sigmaLoad: -0.1, alphaLoad: 0.0, lambdaLoad: +0.2, liquidityTier: 1, lockupMonths: 0 },

  // Crypto
  { name: 'Bitcoin (spot)', ticker: 'BTC', assetClass: 'Crypto', sigmaLoad: +0.9, alphaLoad: +0.8, lambdaLoad: -0.8, liquidityTier: 1, lockupMonths: 0 },
  { name: 'Ethereum (spot)', ticker: 'ETH', assetClass: 'Crypto', sigmaLoad: +0.9, alphaLoad: +0.8, lambdaLoad: -0.8, liquidityTier: 1, lockupMonths: 0 },
  { name: 'iShares Bitcoin Trust ETF', ticker: 'IBIT', assetClass: 'Crypto', sigmaLoad: +0.9, alphaLoad: +0.8, lambdaLoad: -0.8, liquidityTier: 1, lockupMonths: 0 },

  // Cash / MMF
  { name: 'SPDR Bloomberg 1-3 Month T-Bill ETF', ticker: 'BIL', assetClass: 'Cash/MMF', sigmaLoad: -0.8, alphaLoad: 0.0, lambdaLoad: +0.7, liquidityTier: 1, lockupMonths: 0 },
  { name: 'iShares Short Treasury Bond ETF', ticker: 'SHV', assetClass: 'Cash/MMF', sigmaLoad: -0.8, alphaLoad: 0.0, lambdaLoad: +0.7, liquidityTier: 1, lockupMonths: 0 },
]
