import { assignedLevel, parseNum, parseRate } from './portfolio'
import type { ManagedInstrument } from './catalog'
import type { Category, Region } from './instruments'

// ---------------------------------------------------------------------------
// Screenable traits
// ---------------------------------------------------------------------------
// The numeric characteristics an admin can screen a class on. Each trait knows
// how to pull itself out of the instrument's stored detail strings (which are
// formatted for display — "+37.1%", "$12B", "13/11/27" — not stored as numbers),
// so the screener never has to know about formatting.
//
// Every class in both taxonomies is screenable, on the fields that class
// actually carries (see ASSET_FIELD_SPECS / LOCAL_FIELD_SPECS in catalog.tsx):
// analyst upside for equities, yield and duration for bonds, barrier and coupon
// for notes, estimated yield for the local menu.

export type Trait = {
  key: string
  en: string
  es: string
  /** Short unit shown next to the min/max inputs. */
  unit?: string
  /** Decimals used when rendering the value in the results table. */
  dp?: number
  get: (i: ManagedInstrument) => number | null
  /**
   * Ordinal traits (credit ratings) rank rather than measure, so the screener
   * offers them as a single "at least X" select instead of a min/max pair. The
   * ladder is ordered best → worst, and `get` returns the index.
   */
  ladder?: readonly string[]
  /** Raw stored text, used to render an ordinal trait's own label in the table. */
  raw?: (i: ManagedInstrument) => string | undefined
}

const MAG: Record<string, number> = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 }

/** "$86.3B" → 86.3e9. Plain numbers pass through. */
export function magnitude(s: string | undefined): number | null {
  const n = parseNum(s)
  if (n == null) return null
  const m = /([KMBT])\s*$/i.exec((s ?? '').trim())
  return m ? n * MAG[m[1].toUpperCase()] : n
}

/** "13/11/27" (dd/mm/yy) → years from today, negative once matured. */
export function yearsToMaturity(s: string | undefined, now = Date.now()): number | null {
  const m = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/.exec((s ?? '').trim())
  if (!m) return null
  let year = Number(m[3])
  if (year < 100) year += 2000
  const d = Date.UTC(year, Number(m[2]) - 1, Number(m[1]))
  if (!Number.isFinite(d)) return null
  return (d - now) / (365.25 * 24 * 3600 * 1000)
}

// Credit quality as a ladder, so "at least BBB" is a single comparison.
// Lower number = better credit.
export const RATING_LADDER = [
  'AAA', 'AA+', 'AA', 'AA-', 'A+', 'A', 'A-',
  'BBB+', 'BBB', 'BBB-', 'BB+', 'BB', 'BB-',
  'B+', 'B', 'B-', 'CCC+', 'CCC', 'CCC-', 'CC', 'C', 'D',
] as const

// The local (Paraguayan) scale is the same letters with a country suffix —
// "AApy", "BBB+py". Strip the suffix and it lands on the global ladder.
export function ratingRank(raw: string | undefined): number | null {
  const s = (raw ?? '').trim().toUpperCase().replace(/\s+/g, '').replace(/PY$/, '')
  if (!s) return null
  // Take the first rating in a combined string like "A / A2" or "BBB+ (S&P)".
  const head = s.split(/[/,(]/)[0]
  const i = RATING_LADDER.indexOf(head as (typeof RATING_LADDER)[number])
  if (i >= 0) return i
  // Fall back to the longest ladder entry that prefixes it (handles "AA1").
  let best = -1
  let bestLen = 0
  RATING_LADDER.forEach((r, idx) => {
    if (head.startsWith(r) && r.length > bestLen) {
      best = idx
      bestLen = r.length
    }
  })
  return best >= 0 ? best : null
}

const d = (i: ManagedInstrument, k: string) => i.details[k]

const RISK_LEVEL: Trait = { key: 'riskLevel', en: 'Risk level', es: 'Nivel de riesgo', dp: 0, get: (i) => assignedLevel(i) }

const creditTrait = (key: string, en: string, es: string): Trait => ({
  key,
  en,
  es,
  dp: 0,
  ladder: RATING_LADDER,
  get: (i) => ratingRank(d(i, key)),
  raw: (i) => d(i, key),
})

// ── Global ───────────────────────────────────────────────────────────────────

export const EQUITY_TRAITS: Trait[] = [
  // The analyst price target expressed as upside from the last price — the
  // "% increase by analyst estimates" an admin screens on first.
  { key: 'potentialReturn', en: 'Price-target upside', es: 'Potencial vs. precio objetivo', unit: '%', dp: 1, get: (i) => parseRate(d(i, 'potentialReturn')) },
  { key: 'recBuyPct', en: 'Buy-rated', es: 'Recomendación de compra', unit: '%', dp: 0, get: (i) => parseRate(d(i, 'recBuyPct')) },
  { key: 'analystCount', en: 'Analysts covering', es: 'Analistas que cubren', dp: 0, get: (i) => parseRate(d(i, 'analystCount')) },
  { key: 'change1Y', en: '1-year change', es: 'Variación 1 año', unit: '%', dp: 1, get: (i) => parseRate(d(i, 'change1Y')) },
  { key: 'beta', en: 'Beta', es: 'Beta', dp: 2, get: (i) => parseRate(d(i, 'beta')) },
  { key: 'impliedVol3m', en: 'Implied vol (3M)', es: 'Vol. implícita (3M)', unit: '%', dp: 1, get: (i) => parseRate(d(i, 'impliedVol3m')) },
  { key: 'peRatio', en: 'P/E', es: 'Ratio P/E', dp: 1, get: (i) => parseRate(d(i, 'peRatio')) },
  { key: 'peForward', en: 'Forward P/E', es: 'P/E estimado', dp: 1, get: (i) => parseRate(d(i, 'peForward')) },
  { key: 'dividendYield', en: 'Dividend yield', es: 'Rendimiento por dividendo', unit: '%', dp: 2, get: (i) => parseRate(d(i, 'dividendYield')) },
  { key: 'marketCapAum', en: 'Market cap', es: 'Capitalización', unit: '$B', dp: 1, get: (i) => { const v = magnitude(d(i, 'marketCapAum')); return v == null ? null : v / 1e9 } },
  RISK_LEVEL,
]

export const FI_TRAITS: Trait[] = [
  { key: 'ytmBid', en: 'Yield (YTM bid)', es: 'Rendimiento (YTM bid)', unit: '%', dp: 2, get: (i) => parseRate(d(i, 'ytmBid')) },
  { key: 'ytc', en: 'Yield to call', es: 'Rendimiento al call', unit: '%', dp: 2, get: (i) => parseRate(d(i, 'ytc')) },
  { key: 'couponRate', en: 'Coupon', es: 'Cupón', unit: '%', dp: 2, get: (i) => parseRate(d(i, 'couponRate')) },
  { key: 'duration', en: 'Duration', es: 'Duración', unit: 'y', dp: 2, get: (i) => parseRate(d(i, 'duration')) },
  { key: 'maturityYears', en: 'Years to maturity', es: 'Años al vencimiento', unit: 'y', dp: 1, get: (i) => yearsToMaturity(d(i, 'maturity')) },
  { key: 'dividendYield', en: 'Yield (ETFs)', es: 'Rendimiento (ETFs)', unit: '%', dp: 2, get: (i) => parseRate(d(i, 'dividendYield')) },
  { key: 'expenseRatio', en: 'Expense ratio', es: 'Ratio de gastos', unit: '%', dp: 2, get: (i) => parseRate(d(i, 'expenseRatio')) },
  creditTrait('creditRating', 'Credit rating', 'Calificación'),
  RISK_LEVEL,
]

export const NOTE_TRAITS: Trait[] = [
  { key: 'couponYield', en: 'Coupon / premium', es: 'Cupón / prima', unit: '%', dp: 2, get: (i) => parseRate(d(i, 'couponYield')) },
  { key: 'barrier', en: 'Protection barrier', es: 'Barrera de protección', unit: '%', dp: 0, get: (i) => parseRate(d(i, 'barrier')) },
  { key: 'autocallLevel', en: 'Autocall level', es: 'Nivel de autocall', unit: '%', dp: 0, get: (i) => parseRate(d(i, 'autocallLevel')) },
  { key: 'participationRate', en: 'Participation rate', es: 'Nivel de participación', unit: '%', dp: 0, get: (i) => parseRate(d(i, 'participationRate')) },
  { key: 'cap', en: 'Upside cap', es: 'Tope de ganancia', unit: '%', dp: 0, get: (i) => parseRate(d(i, 'cap')) },
  { key: 'protectionLevel', en: 'Capital protected', es: 'Capital protegido', unit: '%', dp: 0, get: (i) => parseRate(d(i, 'protectionLevel')) },
  { key: 'maturityMonths', en: 'Term', es: 'Plazo', unit: 'mo', dp: 0, get: (i) => parseRate(d(i, 'maturityMonths')) },
  creditTrait('issuerRating', 'Issuer rating', 'Calificación del emisor'),
  RISK_LEVEL,
]

// ── Local (Cadiem menu) ──────────────────────────────────────────────────────
// The bulletin publishes an estimated yield for everything, plus a residual term
// for the paper that matures and a manager/unit price for the funds.

const EST_YIELD: Trait = { key: 'estYield', en: 'Estimated yield', es: 'Rendimiento estimado', unit: '%', dp: 2, get: (i) => parseRate(d(i, 'estYield')) }
const RESIDUAL: Trait = { key: 'residualYears', en: 'Residual term', es: 'Plazo residual', unit: 'y', dp: 1, get: (i) => parseRate(d(i, 'residualYears')) }
const LOCAL_RATING = creditTrait('rating', 'Credit rating', 'Calificación')
const MIN_INVESTMENT: Trait = { key: 'minInvestment', en: 'Minimum investment', es: 'Inversión mínima', dp: 0, get: (i) => magnitude(d(i, 'minInvestment')) }

export const LOCAL_FI_TRAITS: Trait[] = [
  EST_YIELD,
  RESIDUAL,
  { key: 'maturityYears', en: 'Years to maturity', es: 'Años al vencimiento', unit: 'y', dp: 1, get: (i) => yearsToMaturity(d(i, 'maturity')) },
  LOCAL_RATING,
  RISK_LEVEL,
]

export const LOCAL_CD_TRAITS: Trait[] = [EST_YIELD, RESIDUAL, LOCAL_RATING, RISK_LEVEL]

export const LOCAL_EQUITY_TRAITS: Trait[] = [
  EST_YIELD,
  { key: 'price', en: 'Price', es: 'Precio', dp: 0, get: (i) => magnitude(d(i, 'price')) },
  LOCAL_RATING,
  RISK_LEVEL,
]

export const LOCAL_MUTUAL_TRAITS: Trait[] = [EST_YIELD, MIN_INVESTMENT, LOCAL_RATING, RISK_LEVEL]

export const LOCAL_INVESTMENT_TRAITS: Trait[] = [
  EST_YIELD,
  { key: 'shareValue', en: 'Share value', es: 'Valor cuota', dp: 0, get: (i) => magnitude(d(i, 'shareValue')) },
  MIN_INVESTMENT,
  RISK_LEVEL,
]

// ── Screens ──────────────────────────────────────────────────────────────────
// One entry per (region, class) the admin can screen and publish. The screener
// renders a tab per screen; `visible` is written across that screen's pool only,
// so narrowing global equities never touches the local menu.

export type Screen = { id: string; region: Region; cls: Category; en: string; es: string; traits: Trait[] }

export const SCREENS: Screen[] = [
  { id: 'g-eq', region: 'global', cls: 'Equities', en: 'Global equities', es: 'Renta variable global', traits: EQUITY_TRAITS },
  { id: 'g-fi', region: 'global', cls: 'Fixed income', en: 'Global fixed income', es: 'Renta fija global', traits: FI_TRAITS },
  { id: 'g-sn', region: 'global', cls: 'Structured notes', en: 'Structured notes', es: 'Notas estructuradas', traits: NOTE_TRAITS },
  { id: 'l-fi', region: 'local', cls: 'Fixed income', en: 'Local fixed income', es: 'Renta fija local', traits: LOCAL_FI_TRAITS },
  { id: 'l-eq', region: 'local', cls: 'Equities', en: 'Local equities', es: 'Renta variable local', traits: LOCAL_EQUITY_TRAITS },
  { id: 'l-cd', region: 'local', cls: 'CDs', en: 'Local CDs', es: 'CDA locales', traits: LOCAL_CD_TRAITS },
  { id: 'l-mf', region: 'local', cls: 'Mutual funds', en: 'Mutual funds', es: 'Fondos mutuos', traits: LOCAL_MUTUAL_TRAITS },
  { id: 'l-if', region: 'local', cls: 'Investment funds', en: 'Investment funds', es: 'Fondos de inversión', traits: LOCAL_INVESTMENT_TRAITS },
]

export type Bound = { min?: number; max?: number }

/**
 * An instrument passes when every bounded trait is inside its range. A trait the
 * instrument has no value for FAILS a bounded filter — screening on "upside over
 * 20%" must not quietly admit names with no analyst coverage at all.
 */
export function passes(inst: ManagedInstrument, traits: Trait[], bounds: Record<string, Bound>): boolean {
  return traits.every((t) => {
    const b = bounds[t.key]
    if (!b || (b.min == null && b.max == null)) return true
    const v = t.get(inst)
    if (v == null) return false
    if (b.min != null && v < b.min) return false
    if (b.max != null && v > b.max) return false
    return true
  })
}
