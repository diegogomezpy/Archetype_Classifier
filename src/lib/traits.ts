import { assignedLevel, parseNum, parseRate } from './portfolio'
import type { ManagedInstrument } from './catalog'

// ---------------------------------------------------------------------------
// Screenable traits
// ---------------------------------------------------------------------------
// The numeric characteristics an admin can screen the global catalog on. Each
// trait knows how to pull itself out of the instrument's stored detail strings
// (which are formatted for display — "+37.1%", "$12B", "13/11/27" — not stored
// as numbers), so the screener never has to know about formatting.

export type Trait = {
  key: string
  en: string
  es: string
  /** Short unit shown next to the min/max inputs. */
  unit?: string
  /** Decimals used when rendering the value in the results table. */
  dp?: number
  get: (i: ManagedInstrument) => number | null
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

export function ratingRank(raw: string | undefined): number | null {
  const s = (raw ?? '').trim().toUpperCase().replace(/\s+/g, '')
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

export const EQUITY_TRAITS: Trait[] = [
  { key: 'potentialReturn', en: 'Analyst upside', es: 'Potencial del analista', unit: '%', dp: 1, get: (i) => parseRate(d(i, 'potentialReturn')) },
  { key: 'recBuyPct', en: 'Buy-rated', es: 'Recomendación de compra', unit: '%', dp: 0, get: (i) => parseRate(d(i, 'recBuyPct')) },
  { key: 'analystCount', en: 'Analysts covering', es: 'Analistas que cubren', dp: 0, get: (i) => parseRate(d(i, 'analystCount')) },
  { key: 'change1Y', en: '1-year change', es: 'Variación 1 año', unit: '%', dp: 1, get: (i) => parseRate(d(i, 'change1Y')) },
  { key: 'beta', en: 'Beta', es: 'Beta', dp: 2, get: (i) => parseRate(d(i, 'beta')) },
  { key: 'impliedVol3m', en: 'Implied vol (3M)', es: 'Vol. implícita (3M)', unit: '%', dp: 1, get: (i) => parseRate(d(i, 'impliedVol3m')) },
  { key: 'peRatio', en: 'P/E', es: 'Ratio P/E', dp: 1, get: (i) => parseRate(d(i, 'peRatio')) },
  { key: 'peForward', en: 'Forward P/E', es: 'P/E estimado', dp: 1, get: (i) => parseRate(d(i, 'peForward')) },
  { key: 'dividendYield', en: 'Dividend yield', es: 'Rendimiento por dividendo', unit: '%', dp: 2, get: (i) => parseRate(d(i, 'dividendYield')) },
  { key: 'marketCapAum', en: 'Market cap', es: 'Capitalización', unit: '$B', dp: 1, get: (i) => { const v = magnitude(d(i, 'marketCapAum')); return v == null ? null : v / 1e9 } },
  { key: 'riskLevel', en: 'Risk level', es: 'Nivel de riesgo', dp: 0, get: (i) => assignedLevel(i) },
]

export const FI_TRAITS: Trait[] = [
  { key: 'ytmBid', en: 'Yield (YTM bid)', es: 'Rendimiento (YTM bid)', unit: '%', dp: 2, get: (i) => parseRate(d(i, 'ytmBid')) },
  { key: 'ytc', en: 'Yield to call', es: 'Rendimiento al call', unit: '%', dp: 2, get: (i) => parseRate(d(i, 'ytc')) },
  { key: 'couponRate', en: 'Coupon', es: 'Cupón', unit: '%', dp: 2, get: (i) => parseRate(d(i, 'couponRate')) },
  { key: 'duration', en: 'Duration', es: 'Duración', unit: 'y', dp: 2, get: (i) => parseRate(d(i, 'duration')) },
  { key: 'maturityYears', en: 'Years to maturity', es: 'Años al vencimiento', unit: 'y', dp: 1, get: (i) => yearsToMaturity(d(i, 'maturity')) },
  { key: 'rating', en: 'Credit rating', es: 'Calificación', dp: 0, get: (i) => ratingRank(d(i, 'creditRating') ?? d(i, 'rating')) },
  { key: 'riskLevel', en: 'Risk level', es: 'Nivel de riesgo', dp: 0, get: (i) => assignedLevel(i) },
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
