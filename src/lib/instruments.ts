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

// Field derivation (documentation only — values filled in below):
//  sigmaLoad: vol tier 1 -> -0.80, 2 -> -0.10, 3 -> +0.50, 4 -> +0.90
//  alphaLoad: negative skew -> -0.80, neutral -> 0.00, positive skew -> +0.80
//  lambdaLoad: loss tier 1 -> +0.70, 2 -> +0.20, 3 -> -0.30, 4 -> -0.80
//  liquidityTier: 1 intraday, 2 secondary market, 3 monthly, 4 locked/OTC
//  lockupMonths: 0 tradeable, 12 for 1-year structures, 36 for 3-year
//
// Single-name equities (S&P 500 selection) use a beta-driven heuristic so they
// stay consistent with the index/sector ETFs above:
//  sigmaLoad: beta < 0.5 -> -0.10, 0.5 <= beta < 1.4 -> +0.50, beta >= 1.4 -> +0.90
//  lambdaLoad: defensive (sigma -0.10) -> +0.20, otherwise -> -0.30
//  alphaLoad: from sector skew character — growth/tech/biotech/innovation -> +0.80,
//             financials/energy/REITs/insurance (negative-skew, tail risk) -> -0.80,
//             cyclical/defensive/staples -> 0.00
// Leveraged equity ETFs (2x/3x) are amplified equity beta: max sigma (+0.90),
// aggressive positive-skew appetite (+0.80), deep negative loss tier (-0.80).
export const INSTRUMENTS: Instrument[] = [
  // Fixed income
  { name: 'iShares 1-3yr Treasury Bond ETF', ticker: 'SHY', assetClass: 'Fixed income', sigmaLoad: -0.8, alphaLoad: 0.0, lambdaLoad: +0.7, liquidityTier: 1, lockupMonths: 0 },
  { name: 'iShares 7-10yr Treasury ETF', ticker: 'IEF', assetClass: 'Fixed income', sigmaLoad: -0.1, alphaLoad: 0.0, lambdaLoad: +0.2, liquidityTier: 1, lockupMonths: 0 },
  { name: 'Vanguard Total Bond Market ETF', ticker: 'BND', assetClass: 'Fixed income', sigmaLoad: -0.1, alphaLoad: 0.0, lambdaLoad: +0.2, liquidityTier: 1, lockupMonths: 0 },
  { name: 'iShares iBoxx HY Corporate Bond ETF', ticker: 'HYG', assetClass: 'Fixed income', sigmaLoad: -0.1, alphaLoad: -0.8, lambdaLoad: -0.3, liquidityTier: 1, lockupMonths: 0 },
  { name: 'BVA Paraguay sovereign bond', ticker: 'OTC', assetClass: 'Fixed income', sigmaLoad: -0.8, alphaLoad: 0.0, lambdaLoad: +0.7, liquidityTier: 2, lockupMonths: 0 },
  { name: 'BVA investment grade corporate', ticker: 'OTC', assetClass: 'Fixed income', sigmaLoad: -0.1, alphaLoad: -0.8, lambdaLoad: +0.2, liquidityTier: 2, lockupMonths: 0 },

  // Equities — broad
  { name: 'Vanguard Total World Stock ETF', ticker: 'VT', assetClass: 'Equities', sigmaLoad: +0.5, alphaLoad: 0.0, lambdaLoad: -0.3, liquidityTier: 1, lockupMonths: 0 },
  { name: 'SPDR S&P 500 ETF', ticker: 'SPY', assetClass: 'Equities', sigmaLoad: +0.5, alphaLoad: 0.0, lambdaLoad: -0.3, liquidityTier: 1, lockupMonths: 0 },
  { name: 'Invesco QQQ (Nasdaq-100)', ticker: 'QQQ', assetClass: 'Equities', sigmaLoad: +0.5, alphaLoad: +0.8, lambdaLoad: -0.3, liquidityTier: 1, lockupMonths: 0 },
  { name: 'iShares MSCI Emerging Markets ETF', ticker: 'EEM', assetClass: 'Equities', sigmaLoad: +0.5, alphaLoad: +0.8, lambdaLoad: -0.3, liquidityTier: 1, lockupMonths: 0 },
  { name: 'iShares MSCI World ETF', ticker: 'URTH', assetClass: 'Equities', sigmaLoad: +0.5, alphaLoad: 0.0, lambdaLoad: -0.3, liquidityTier: 1, lockupMonths: 0 },

  // Equities — sector
  { name: 'Technology Select Sector SPDR', ticker: 'XLK', assetClass: 'Equities', sigmaLoad: +0.5, alphaLoad: +0.8, lambdaLoad: -0.3, liquidityTier: 1, lockupMonths: 0 },
  { name: 'Energy Select Sector SPDR', ticker: 'XLE', assetClass: 'Equities', sigmaLoad: +0.5, alphaLoad: -0.8, lambdaLoad: -0.3, liquidityTier: 1, lockupMonths: 0 },
  { name: 'Financial Select Sector SPDR', ticker: 'XLF', assetClass: 'Equities', sigmaLoad: +0.5, alphaLoad: -0.8, lambdaLoad: -0.3, liquidityTier: 1, lockupMonths: 0 },
  { name: 'Health Care Select Sector SPDR', ticker: 'XLV', assetClass: 'Equities', sigmaLoad: -0.1, alphaLoad: 0.0, lambdaLoad: +0.2, liquidityTier: 1, lockupMonths: 0 },
  { name: 'Utilities Select Sector SPDR', ticker: 'XLU', assetClass: 'Equities', sigmaLoad: -0.1, alphaLoad: 0.0, lambdaLoad: +0.2, liquidityTier: 1, lockupMonths: 0 },
  { name: 'iShares Global Clean Energy ETF', ticker: 'ICLN', assetClass: 'Equities', sigmaLoad: +0.5, alphaLoad: +0.8, lambdaLoad: -0.3, liquidityTier: 1, lockupMonths: 0 },

  // Equities — factor
  { name: 'iShares MSCI USA Momentum Factor ETF', ticker: 'MTUM', assetClass: 'Equities', sigmaLoad: +0.5, alphaLoad: +0.8, lambdaLoad: -0.3, liquidityTier: 1, lockupMonths: 0 },
  { name: 'iShares MSCI USA Value Factor ETF', ticker: 'VLUE', assetClass: 'Equities', sigmaLoad: +0.5, alphaLoad: 0.0, lambdaLoad: -0.3, liquidityTier: 1, lockupMonths: 0 },
  { name: 'iShares MSCI USA Min Vol Factor ETF', ticker: 'USMV', assetClass: 'Equities', sigmaLoad: -0.1, alphaLoad: 0.0, lambdaLoad: +0.2, liquidityTier: 1, lockupMonths: 0 },

  // Equities — single names (S&P 500 selection; β-driven σ, sector α, vol-tier λ)
  { name: 'General Motors', ticker: 'GM', assetClass: 'Equities', sigmaLoad: +0.9, alphaLoad: 0.0, lambdaLoad: -0.3, liquidityTier: 1, lockupMonths: 0 },
  { name: 'Aptiv PLC', ticker: 'APTV', assetClass: 'Equities', sigmaLoad: +0.9, alphaLoad: 0.0, lambdaLoad: -0.3, liquidityTier: 1, lockupMonths: 0 },
  { name: 'Wells Fargo & Co', ticker: 'WFC', assetClass: 'Equities', sigmaLoad: +0.5, alphaLoad: -0.8, lambdaLoad: -0.3, liquidityTier: 1, lockupMonths: 0 },
  { name: 'Huntington Bancshares', ticker: 'HBAN', assetClass: 'Equities', sigmaLoad: +0.5, alphaLoad: -0.8, lambdaLoad: -0.3, liquidityTier: 1, lockupMonths: 0 },
  { name: 'Pentair PLC', ticker: 'PNR', assetClass: 'Equities', sigmaLoad: +0.5, alphaLoad: 0.0, lambdaLoad: -0.3, liquidityTier: 1, lockupMonths: 0 },
  { name: 'Xylem Inc', ticker: 'XYL', assetClass: 'Equities', sigmaLoad: +0.5, alphaLoad: 0.0, lambdaLoad: -0.3, liquidityTier: 1, lockupMonths: 0 },
  { name: 'Broadridge Financial Solutions', ticker: 'BR', assetClass: 'Equities', sigmaLoad: -0.1, alphaLoad: 0.0, lambdaLoad: +0.2, liquidityTier: 1, lockupMonths: 0 },
  { name: 'Rollins Inc', ticker: 'ROL', assetClass: 'Equities', sigmaLoad: -0.1, alphaLoad: 0.0, lambdaLoad: +0.2, liquidityTier: 1, lockupMonths: 0 },
  { name: 'Tractor Supply Company', ticker: 'TSCO', assetClass: 'Equities', sigmaLoad: -0.1, alphaLoad: 0.0, lambdaLoad: +0.2, liquidityTier: 1, lockupMonths: 0 },
  { name: 'Carvana Co', ticker: 'CVNA', assetClass: 'Equities', sigmaLoad: +0.5, alphaLoad: +0.8, lambdaLoad: -0.3, liquidityTier: 1, lockupMonths: 0 },
  { name: 'Nike Inc', ticker: 'NKE', assetClass: 'Equities', sigmaLoad: +0.5, alphaLoad: 0.0, lambdaLoad: -0.3, liquidityTier: 1, lockupMonths: 0 },
  { name: 'Tapestry Inc', ticker: 'TPR', assetClass: 'Equities', sigmaLoad: +0.5, alphaLoad: 0.0, lambdaLoad: -0.3, liquidityTier: 1, lockupMonths: 0 },
  { name: 'DoorDash Inc', ticker: 'DASH', assetClass: 'Equities', sigmaLoad: +0.5, alphaLoad: +0.8, lambdaLoad: -0.3, liquidityTier: 1, lockupMonths: 0 },
  { name: 'Las Vegas Sands Corp', ticker: 'LVS', assetClass: 'Equities', sigmaLoad: -0.1, alphaLoad: 0.0, lambdaLoad: +0.2, liquidityTier: 1, lockupMonths: 0 },
  { name: 'Kroger Co', ticker: 'KR', assetClass: 'Equities', sigmaLoad: -0.1, alphaLoad: 0.0, lambdaLoad: +0.2, liquidityTier: 1, lockupMonths: 0 },
  { name: 'Walmart Inc', ticker: 'WMT', assetClass: 'Equities', sigmaLoad: -0.1, alphaLoad: 0.0, lambdaLoad: +0.2, liquidityTier: 1, lockupMonths: 0 },
  { name: 'Expand Energy Corp', ticker: 'EXE', assetClass: 'Equities', sigmaLoad: -0.1, alphaLoad: -0.8, lambdaLoad: +0.2, liquidityTier: 1, lockupMonths: 0 },
  { name: 'EQT Corp', ticker: 'EQT', assetClass: 'Equities', sigmaLoad: -0.1, alphaLoad: -0.8, lambdaLoad: +0.2, liquidityTier: 1, lockupMonths: 0 },
  { name: 'Weyerhaeuser Co', ticker: 'WY', assetClass: 'Equities', sigmaLoad: +0.5, alphaLoad: -0.8, lambdaLoad: -0.3, liquidityTier: 1, lockupMonths: 0 },
  { name: 'Digital Realty Trust', ticker: 'DLR', assetClass: 'Equities', sigmaLoad: +0.5, alphaLoad: -0.8, lambdaLoad: -0.3, liquidityTier: 1, lockupMonths: 0 },
  { name: 'Fidelity National Information', ticker: 'FIS', assetClass: 'Equities', sigmaLoad: -0.1, alphaLoad: 0.0, lambdaLoad: +0.2, liquidityTier: 1, lockupMonths: 0 },
  { name: 'Coinbase Global', ticker: 'COIN', assetClass: 'Equities', sigmaLoad: +0.9, alphaLoad: +0.8, lambdaLoad: -0.8, liquidityTier: 1, lockupMonths: 0 },
  { name: 'Tyson Foods', ticker: 'TSN', assetClass: 'Equities', sigmaLoad: -0.1, alphaLoad: 0.0, lambdaLoad: +0.2, liquidityTier: 1, lockupMonths: 0 },
  { name: 'McCormick & Co', ticker: 'MKC', assetClass: 'Equities', sigmaLoad: -0.1, alphaLoad: 0.0, lambdaLoad: +0.2, liquidityTier: 1, lockupMonths: 0 },
  { name: 'Boston Scientific Corp', ticker: 'BSX', assetClass: 'Equities', sigmaLoad: -0.1, alphaLoad: +0.8, lambdaLoad: +0.2, liquidityTier: 1, lockupMonths: 0 },
  { name: 'Insulet Corp', ticker: 'PODD', assetClass: 'Equities', sigmaLoad: -0.1, alphaLoad: +0.8, lambdaLoad: +0.2, liquidityTier: 1, lockupMonths: 0 },
  { name: 'Kimberly-Clark Corp', ticker: 'KMB', assetClass: 'Equities', sigmaLoad: -0.1, alphaLoad: 0.0, lambdaLoad: +0.2, liquidityTier: 1, lockupMonths: 0 },
  { name: 'Procter & Gamble Co', ticker: 'PG', assetClass: 'Equities', sigmaLoad: -0.1, alphaLoad: 0.0, lambdaLoad: +0.2, liquidityTier: 1, lockupMonths: 0 },
  { name: 'Willis Towers Watson', ticker: 'WTW', assetClass: 'Equities', sigmaLoad: -0.1, alphaLoad: -0.8, lambdaLoad: +0.2, liquidityTier: 1, lockupMonths: 0 },
  { name: 'Arthur J Gallagher & Co', ticker: 'AJG', assetClass: 'Equities', sigmaLoad: -0.1, alphaLoad: -0.8, lambdaLoad: +0.2, liquidityTier: 1, lockupMonths: 0 },
  { name: 'Newmont Corp', ticker: 'NEM', assetClass: 'Equities', sigmaLoad: +0.9, alphaLoad: 0.0, lambdaLoad: -0.3, liquidityTier: 1, lockupMonths: 0 },
  { name: 'CRH PLC', ticker: 'CRH', assetClass: 'Equities', sigmaLoad: +0.5, alphaLoad: 0.0, lambdaLoad: -0.3, liquidityTier: 1, lockupMonths: 0 },
  { name: 'Meta Platforms', ticker: 'META', assetClass: 'Equities', sigmaLoad: +0.5, alphaLoad: +0.8, lambdaLoad: -0.3, liquidityTier: 1, lockupMonths: 0 },
  { name: 'Netflix Inc', ticker: 'NFLX', assetClass: 'Equities', sigmaLoad: -0.1, alphaLoad: +0.8, lambdaLoad: +0.2, liquidityTier: 1, lockupMonths: 0 },
  { name: 'Zoetis Inc', ticker: 'ZTS', assetClass: 'Equities', sigmaLoad: -0.1, alphaLoad: 0.0, lambdaLoad: +0.2, liquidityTier: 1, lockupMonths: 0 },
  { name: 'Regeneron Pharmaceuticals', ticker: 'REGN', assetClass: 'Equities', sigmaLoad: +0.5, alphaLoad: +0.8, lambdaLoad: -0.3, liquidityTier: 1, lockupMonths: 0 },
  { name: 'CoStar Group', ticker: 'CSGP', assetClass: 'Equities', sigmaLoad: -0.1, alphaLoad: +0.8, lambdaLoad: +0.2, liquidityTier: 1, lockupMonths: 0 },
  { name: 'CBRE Group', ticker: 'CBRE', assetClass: 'Equities', sigmaLoad: -0.1, alphaLoad: 0.0, lambdaLoad: +0.2, liquidityTier: 1, lockupMonths: 0 },
  { name: 'NVIDIA Corp', ticker: 'NVDA', assetClass: 'Equities', sigmaLoad: +0.9, alphaLoad: +0.8, lambdaLoad: -0.3, liquidityTier: 1, lockupMonths: 0 },
  { name: 'Broadcom Inc', ticker: 'AVGO', assetClass: 'Equities', sigmaLoad: +0.9, alphaLoad: +0.8, lambdaLoad: -0.3, liquidityTier: 1, lockupMonths: 0 },
  { name: 'Intuit Inc', ticker: 'INTU', assetClass: 'Equities', sigmaLoad: -0.1, alphaLoad: +0.8, lambdaLoad: +0.2, liquidityTier: 1, lockupMonths: 0 },
  { name: 'Trimble Inc', ticker: 'TRMB', assetClass: 'Equities', sigmaLoad: +0.5, alphaLoad: +0.8, lambdaLoad: -0.3, liquidityTier: 1, lockupMonths: 0 },
  { name: 'Zebra Technologies', ticker: 'ZBRA', assetClass: 'Equities', sigmaLoad: +0.9, alphaLoad: +0.8, lambdaLoad: -0.3, liquidityTier: 1, lockupMonths: 0 },
  { name: 'Hewlett Packard Enterprise', ticker: 'HPE', assetClass: 'Equities', sigmaLoad: +0.9, alphaLoad: +0.8, lambdaLoad: -0.3, liquidityTier: 1, lockupMonths: 0 },
  { name: 'T-Mobile US', ticker: 'TMUS', assetClass: 'Equities', sigmaLoad: -0.1, alphaLoad: 0.0, lambdaLoad: +0.2, liquidityTier: 1, lockupMonths: 0 },
  { name: 'Comcast Corp', ticker: 'CMCSA', assetClass: 'Equities', sigmaLoad: -0.1, alphaLoad: 0.0, lambdaLoad: +0.2, liquidityTier: 1, lockupMonths: 0 },
  { name: 'Uber Technologies', ticker: 'UBER', assetClass: 'Equities', sigmaLoad: +0.5, alphaLoad: +0.8, lambdaLoad: -0.3, liquidityTier: 1, lockupMonths: 0 },
  { name: 'United Airlines Holdings', ticker: 'UAL', assetClass: 'Equities', sigmaLoad: +0.9, alphaLoad: 0.0, lambdaLoad: -0.3, liquidityTier: 1, lockupMonths: 0 },
  { name: 'NRG Energy', ticker: 'NRG', assetClass: 'Equities', sigmaLoad: +0.9, alphaLoad: 0.0, lambdaLoad: -0.3, liquidityTier: 1, lockupMonths: 0 },
  { name: 'Vistra Corp', ticker: 'VST', assetClass: 'Equities', sigmaLoad: +0.9, alphaLoad: 0.0, lambdaLoad: -0.3, liquidityTier: 1, lockupMonths: 0 },

  // Equities — leveraged ETFs (2x / 3x daily; amplified equity beta: max σ,
  // aggressive positive-skew appetite, deep negative loss tier)
  { name: 'ProShares Ultra S&P 500 (2x)', ticker: 'SSO', assetClass: 'Equities', sigmaLoad: +0.9, alphaLoad: +0.8, lambdaLoad: -0.8, liquidityTier: 1, lockupMonths: 0 },
  { name: 'ProShares Ultra QQQ (2x)', ticker: 'QLD', assetClass: 'Equities', sigmaLoad: +0.9, alphaLoad: +0.8, lambdaLoad: -0.8, liquidityTier: 1, lockupMonths: 0 },
  { name: 'ProShares Ultra Dow30 (2x)', ticker: 'DDM', assetClass: 'Equities', sigmaLoad: +0.9, alphaLoad: +0.8, lambdaLoad: -0.8, liquidityTier: 1, lockupMonths: 0 },
  { name: 'ProShares Ultra Technology (2x)', ticker: 'ROM', assetClass: 'Equities', sigmaLoad: +0.9, alphaLoad: +0.8, lambdaLoad: -0.8, liquidityTier: 1, lockupMonths: 0 },
  { name: 'ProShares Ultra Russell2000 (2x)', ticker: 'UWM', assetClass: 'Equities', sigmaLoad: +0.9, alphaLoad: +0.8, lambdaLoad: -0.8, liquidityTier: 1, lockupMonths: 0 },
  { name: 'ProShares Ultra MidCap400 (2x)', ticker: 'MVV', assetClass: 'Equities', sigmaLoad: +0.9, alphaLoad: +0.8, lambdaLoad: -0.8, liquidityTier: 1, lockupMonths: 0 },
  { name: 'ProShares UltraPro S&P 500 (3x)', ticker: 'UPRO', assetClass: 'Equities', sigmaLoad: +0.9, alphaLoad: +0.8, lambdaLoad: -0.8, liquidityTier: 1, lockupMonths: 0 },
  { name: 'ProShares UltraPro QQQ (3x)', ticker: 'TQQQ', assetClass: 'Equities', sigmaLoad: +0.9, alphaLoad: +0.8, lambdaLoad: -0.8, liquidityTier: 1, lockupMonths: 0 },
  { name: 'ProShares UltraPro Dow30 (3x)', ticker: 'UDOW', assetClass: 'Equities', sigmaLoad: +0.9, alphaLoad: +0.8, lambdaLoad: -0.8, liquidityTier: 1, lockupMonths: 0 },
  { name: 'Direxion Small Cap Bull (3x)', ticker: 'TNA', assetClass: 'Equities', sigmaLoad: +0.9, alphaLoad: +0.8, lambdaLoad: -0.8, liquidityTier: 1, lockupMonths: 0 },
  { name: 'Direxion Semiconductor Bull (3x)', ticker: 'SOXL', assetClass: 'Equities', sigmaLoad: +0.9, alphaLoad: +0.8, lambdaLoad: -0.8, liquidityTier: 1, lockupMonths: 0 },
  { name: 'Direxion Financial Bull (3x)', ticker: 'FAS', assetClass: 'Equities', sigmaLoad: +0.9, alphaLoad: +0.8, lambdaLoad: -0.8, liquidityTier: 1, lockupMonths: 0 },
  { name: 'Direxion Technology Bull (3x)', ticker: 'TECL', assetClass: 'Equities', sigmaLoad: +0.9, alphaLoad: +0.8, lambdaLoad: -0.8, liquidityTier: 1, lockupMonths: 0 },
  { name: 'MicroSectors FANG+ (3x)', ticker: 'FNGU', assetClass: 'Equities', sigmaLoad: +0.9, alphaLoad: +0.8, lambdaLoad: -0.8, liquidityTier: 1, lockupMonths: 0 },

  // Income structures — carry / negative skew
  { name: 'Phoenix autocallable (monthly obs.)', ticker: 'OTC', assetClass: 'Income structures', sigmaLoad: -0.1, alphaLoad: -0.8, lambdaLoad: -0.3, liquidityTier: 4, lockupMonths: 12 },
  { name: 'Reverse convertible (barrier)', ticker: 'OTC', assetClass: 'Income structures', sigmaLoad: -0.1, alphaLoad: -0.8, lambdaLoad: -0.8, liquidityTier: 4, lockupMonths: 12 },
  { name: 'Global X S&P 500 Covered Call ETF', ticker: 'XYLD', assetClass: 'Income structures', sigmaLoad: -0.1, alphaLoad: -0.8, lambdaLoad: +0.2, liquidityTier: 1, lockupMonths: 0 },
  { name: 'Digital/binary structured note', ticker: 'OTC', assetClass: 'Income structures', sigmaLoad: -0.1, alphaLoad: 0.0, lambdaLoad: +0.2, liquidityTier: 4, lockupMonths: 12 },
  { name: 'Iron condor strategy (index)', ticker: 'Listed', assetClass: 'Income structures', sigmaLoad: -0.1, alphaLoad: -0.8, lambdaLoad: -0.3, liquidityTier: 1, lockupMonths: 0 },

  // Growth structures — convex / positive skew
  { name: 'Capital-protected note + participation', ticker: 'OTC', assetClass: 'Growth structures', sigmaLoad: -0.8, alphaLoad: +0.8, lambdaLoad: +0.7, liquidityTier: 4, lockupMonths: 12 },
  { name: 'Uncapped participation note', ticker: 'OTC', assetClass: 'Growth structures', sigmaLoad: +0.5, alphaLoad: +0.8, lambdaLoad: +0.2, liquidityTier: 4, lockupMonths: 12 },
  { name: 'S&P 500 LEAP call options', ticker: 'Listed', assetClass: 'Growth structures', sigmaLoad: +0.9, alphaLoad: +0.8, lambdaLoad: -0.8, liquidityTier: 1, lockupMonths: 0 },
  { name: 'Protective put overlay on equity', ticker: 'Listed', assetClass: 'Growth structures', sigmaLoad: -0.8, alphaLoad: +0.8, lambdaLoad: +0.7, liquidityTier: 1, lockupMonths: 0 },

  // Alternatives
  { name: 'iShares Gold Trust', ticker: 'IAU', assetClass: 'Alternatives', sigmaLoad: -0.1, alphaLoad: 0.0, lambdaLoad: +0.2, liquidityTier: 1, lockupMonths: 0 },
  { name: 'Invesco Optimum Yield Commodity ETF', ticker: 'PDBC', assetClass: 'Alternatives', sigmaLoad: +0.5, alphaLoad: 0.0, lambdaLoad: -0.3, liquidityTier: 1, lockupMonths: 0 },
  { name: 'iShares Global REIT ETF', ticker: 'REET', assetClass: 'Alternatives', sigmaLoad: +0.5, alphaLoad: -0.8, lambdaLoad: -0.3, liquidityTier: 1, lockupMonths: 0 },
  { name: 'iMGP DBi Managed Futures ETF', ticker: 'DBMF', assetClass: 'Alternatives', sigmaLoad: -0.1, alphaLoad: 0.0, lambdaLoad: +0.2, liquidityTier: 1, lockupMonths: 0 },
  { name: 'Invesco Senior Loan ETF', ticker: 'BKLN', assetClass: 'Alternatives', sigmaLoad: -0.1, alphaLoad: -0.8, lambdaLoad: +0.2, liquidityTier: 2, lockupMonths: 0 },

  // Crypto
  { name: 'Bitcoin (spot)', ticker: 'BTC', assetClass: 'Crypto', sigmaLoad: +0.9, alphaLoad: +0.8, lambdaLoad: -0.8, liquidityTier: 1, lockupMonths: 0 },
  { name: 'Ethereum (spot)', ticker: 'ETH', assetClass: 'Crypto', sigmaLoad: +0.9, alphaLoad: +0.8, lambdaLoad: -0.8, liquidityTier: 1, lockupMonths: 0 },
  { name: 'iShares Bitcoin Trust ETF', ticker: 'IBIT', assetClass: 'Crypto', sigmaLoad: +0.9, alphaLoad: +0.8, lambdaLoad: -0.8, liquidityTier: 1, lockupMonths: 0 },
  { name: 'Diversified crypto basket (top 5)', ticker: 'OTC', assetClass: 'Crypto', sigmaLoad: +0.9, alphaLoad: +0.8, lambdaLoad: -0.8, liquidityTier: 1, lockupMonths: 0 },

  // Cash / MMF
  { name: 'SPDR Bloomberg 1-3 Month T-Bill ETF', ticker: 'BIL', assetClass: 'Cash/MMF', sigmaLoad: -0.8, alphaLoad: 0.0, lambdaLoad: +0.7, liquidityTier: 1, lockupMonths: 0 },
  { name: 'iShares Short Treasury Bond ETF', ticker: 'SHV', assetClass: 'Cash/MMF', sigmaLoad: -0.8, alphaLoad: 0.0, lambdaLoad: +0.7, liquidityTier: 1, lockupMonths: 0 },
]
