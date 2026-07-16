import type { ManagedInstrument } from './catalog'
import type { LocalCategory } from './instruments'
import { deriveDefaults, deriveRiskVector } from './riskDerivation'
import type { ImportResult } from './importSchema'

// ---------------------------------------------------------------------------
// Cadiem bulletin parser
// ---------------------------------------------------------------------------
// Reconstructs local instruments from the text lines of the Cadiem "Oportunidades
// de Inversión" bulletin (see data/cadiemLocal.ts for the same tables transcribed
// by hand). It's keyed on the bulletin's fixed structure: labelled sections
// (bonds ₲ / bonds USD / CDA / mutual funds / investment funds / equities), then
// one instrument per data row. Extraction is pattern-based (a credit-rating
// token, a dd/mm/yyyy maturity, dot-grouped amounts) so column drift doesn't
// break it — but it's best-effort, which is why the caller previews before
// adding. σ/α/λ are derived from category + rating like every other import.

const KIND: Record<LocalCategory, string> = {
  'Fixed income': 'Bono',
  CDs: 'CDA',
  'Mutual funds': 'Fondo mutuo',
  'Investment funds': 'Fondo de inversión',
  Equities: 'Acción',
}

const deaccent = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
const norm = (s: string) => deaccent(s).toLowerCase()

// Credit-rating token, e.g. AAAPy, AA-py, A+py, BBB Py, AAfpy, Af-py, AAf-py.
const RATING = /[A-D]{1,3}[+-]?f?[+-]?\s?[Pp]y/
const DATE = /\d{1,2}\/\d{1,2}\/\d{4}/g
const AMOUNT = /\d{1,3}(?:\.\d{3})+(?:,\d+)?/g // 1.960.000.000 or 5.000,00
const DECIMAL = /\d+,\d+/g // 10,85 or 2,8
const COUPON = /(mensual|bimestral|trimestral|semestral|anual|al vencimiento)/i

type Section = { category: LocalCategory; currency?: 'PYG' | 'USD'; label: string }

// Is this line a section header? Returns the section it opens, else null.
function detectSection(line: string): Section | null {
  const n = norm(line)
  if (n.length > 60) return null // headers are short; skip prose/rows
  if (/fondos? de inversion/.test(n)) return { category: 'Investment funds', label: 'Fondos de inversión' }
  if (/fondos? mutuos?/.test(n)) return { category: 'Mutual funds', label: 'Fondos mutuos' }
  if (/certificado de dep|\bcda\b/.test(n)) return { category: 'CDs', currency: 'PYG', label: 'CDA' }
  if (/renta variable|\bacciones\b/.test(n)) return { category: 'Equities', currency: 'PYG', label: 'Renta variable' }
  if (/\bbonos?\b|renta fija/.test(n)) {
    if (/dolar|usd/.test(n)) return { category: 'Fixed income', currency: 'USD', label: 'Bonos USD' }
    return { category: 'Fixed income', currency: 'PYG', label: 'Bonos ₲' }
  }
  return null
}

// A short currency sub-header inside a section (e.g. "En Dólares").
function detectCurrency(line: string): 'PYG' | 'USD' | null {
  const n = norm(line)
  if (n.length > 24) return null
  if (/dolar|usd|us\$/.test(n)) return 'USD'
  if (/guarani|\bpyg\b|\bgs\b/.test(n)) return 'PYG'
  return null
}

const curLabel = (c?: 'PYG' | 'USD') => (c === 'USD' ? 'USD ($)' : 'PYG (₲)')
const money = (c: 'PYG' | 'USD' | undefined, v: string) => `${c === 'USD' ? '$' : '₲'} ${v}`

function put(details: Record<string, string>, key: string, val?: string) {
  if (val && val.trim()) details[key] = val.trim()
}

// Fund yields show as a %-range ("10% - 11%"), a single % ("9,23%"), or a bare
// decimal ("6,83"). Return the first that matches, normalized with a % suffix.
function fundYield(text: string): string | undefined {
  const range = text.match(/\d+(?:,\d+)?\s*%\s*[-–]\s*\d+(?:,\d+)?\s*%/)
  if (range) return range[0].replace(/\s+/g, ' ')
  const pct = text.match(/\d+(?:,\d+)?\s*%/)
  if (pct) return pct[0].replace(/\s+/g, '')
  const dec = text.match(DECIMAL)
  return dec ? `${dec[0]}%` : undefined
}

// Split a data row into { issuer (before rating), rest (after), rating }.
function splitByRating(line: string): { issuer: string; rest: string; rating: string } | null {
  const m = line.match(RATING)
  if (!m || m.index == null) return null
  return {
    issuer: line.slice(0, m.index).trim().replace(/[·|]+$/, '').trim(),
    rest: line.slice(m.index + m[0].length).trim(),
    rating: m[0].replace(/\s+/g, ' ').trim(),
  }
}

// A row must carry real content — a rating, a date, an amount, a decimal, or a
// percent — to be an instrument (filters out column headers and page furniture).
function looksLikeRow(line: string): boolean {
  return (
    RATING.test(line) ||
    /\d{1,2}\/\d{1,2}\/\d{4}/.test(line) ||
    /\d{1,3}(?:\.\d{3})+/.test(line) ||
    /\d+,\d+/.test(line) ||
    /\d+\s*%/.test(line)
  )
}

function parseDebtRow(
  section: Section,
  currency: 'PYG' | 'USD' | undefined,
  line: string,
): { name: string; details: Record<string, string>; rating?: string } | null {
  const split = splitByRating(line)
  const issuer = (split?.issuer || line).replace(/\s{2,}/g, ' ').trim()
  if (!issuer) return null
  const rest = split?.rest ?? line
  const details: Record<string, string> = {}
  put(details, 'issuer', issuer)
  if (split?.rating) put(details, 'rating', split.rating)

  const dates = rest.match(DATE)
  if (dates?.length) put(details, 'maturity', dates[dates.length - 1])
  const coupon = rest.match(COUPON)
  if (coupon) put(details, 'couponFrequency', coupon[1][0].toUpperCase() + coupon[1].slice(1).toLowerCase())

  // Amount: the largest dot-grouped figure. Strip amounts before scanning
  // decimals so the fractional tail of "5.000,00" isn't misread as a residual.
  const amounts = rest.match(AMOUNT) || []
  if (amounts.length) {
    const biggest = amounts.slice().sort((a, b) => b.replace(/\D/g, '').length - a.replace(/\D/g, '').length)[0]
    put(details, 'available', money(currency, biggest))
  }
  let scan = rest
  for (const a of amounts) scan = scan.replace(a, ' ')
  // Yield: a small decimal (< 100). Residual: a small decimal (< 40) after it.
  const decimals = (scan.match(DECIMAL) || []).map((d) => ({ raw: d, n: parseFloat(d.replace('.', '').replace(',', '.')) }))
  const yld = decimals.find((d) => d.n < 100)
  if (yld) put(details, 'estYield', `${yld.raw}%`)
  const residual = decimals.filter((d) => d !== yld).find((d) => d.n < 40)
  if (residual) put(details, 'residualYears', residual.raw)
  put(details, 'currency', curLabel(currency))
  return { name: issuer, details, rating: split?.rating }
}

function parseFundRow(
  section: Section,
  currency: 'PYG' | 'USD' | undefined,
  line: string,
): { name: string; details: Record<string, string>; rating?: string } | null {
  // Fund name = leading text up to the first rating / number column.
  const split = splitByRating(line)
  let name = split?.issuer || ''
  const rest = split?.rest ?? line
  if (!name) {
    const cut = line.search(/\d/)
    name = (cut > 0 ? line.slice(0, cut) : line).trim()
  }
  name = name.replace(/\s{2,}/g, ' ').trim()
  if (name.length < 3) return null
  const details: Record<string, string> = {}
  put(details, 'fundManager', 'Cadiem')
  if (split?.rating) put(details, 'rating', split.rating)
  put(details, 'estYield', fundYield(rest))
  put(details, 'currency', curLabel(currency))
  return { name, details, rating: split?.rating }
}

function parseEquityRow(
  currency: 'PYG' | 'USD' | undefined,
  line: string,
): { name: string; details: Record<string, string>; rating?: string } | null {
  const split = splitByRating(line)
  const issuer = (split?.issuer || '').replace(/\s{2,}/g, ' ').trim()
  if (!issuer) return null
  const rest = split?.rest ?? ''
  const details: Record<string, string> = {}
  put(details, 'issuer', issuer)
  if (split?.rating) put(details, 'rating', split.rating)
  // Share type is the trailing descriptive phrase ("Acciones preferidas",
  // "Acciones electrónicas (vtos. trimestrales)").
  const typeMatch = rest.match(/acci[oó]n[a-záéíóúñ .()/-]*/i)
  if (typeMatch) put(details, 'shareType', typeMatch[0].replace(/\s{2,}/g, ' ').trim())
  const amounts = rest.match(AMOUNT) || []
  if (amounts[0]) put(details, 'price', money(currency, amounts[0]))
  let scan = rest
  for (const a of amounts) scan = scan.replace(a, ' ')
  const pct = scan.match(DECIMAL)
  if (pct?.length) put(details, 'estYield', `${pct[0]}%`)
  put(details, 'currency', curLabel(currency))
  const name = details.shareType ? `${issuer} — ${details.shareType}` : issuer
  return { name, details, rating: split?.rating }
}

/** Parse the whole bulletin's text lines into local instruments. */
export function parseBulletin(lines: string[]): ImportResult {
  const instruments: ManagedInstrument[] = []
  const sectionsSeen: string[] = []
  const seen = new Set<string>()
  let section: Section | null = null
  let currency: 'PYG' | 'USD' | undefined
  let skipped = 0
  let seq = 0

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue

    // Headers/sub-headers carry no data. Fund NAMES contain the section keywords
    // ("Fondo Mutuo…"), so only a digit-free line can open a section — otherwise
    // those rows would be swallowed as headers.
    if (!/\d/.test(line)) {
      const next = detectSection(line)
      if (next) {
        section = next
        currency = next.currency
        if (!sectionsSeen.includes(next.label)) sectionsSeen.push(next.label)
        continue
      }
      const cur = detectCurrency(line)
      if (cur) currency = cur
      continue
    }

    if (!section) continue
    if (!looksLikeRow(line)) continue

    const parsed =
      section.category === 'Equities'
        ? parseEquityRow(currency, line)
        : section.category === 'Mutual funds' || section.category === 'Investment funds'
          ? parseFundRow(section, currency, line)
          : parseDebtRow(section, currency, line)
    if (!parsed || !parsed.name) {
      skipped++
      continue
    }

    const cat = section.category
    const vec = deriveRiskVector('local', cat, parsed.rating ? { rating: parsed.rating } : {})
    const def = deriveDefaults('local', cat)
    seq += 1
    let id = `blt-${cat.toLowerCase().replace(/[^a-z]+/g, '')}-${String(seq).padStart(2, '0')}`
    while (seen.has(id)) id += 'x'
    seen.add(id)

    instruments.push({
      id,
      name: parsed.name,
      ticker: '',
      region: 'local',
      assetClass: cat,
      kind: cat === 'Equities' ? parsed.details.shareType || KIND[cat] : KIND[cat],
      sigmaLoad: vec.sigmaLoad,
      alphaLoad: vec.alphaLoad,
      lambdaLoad: vec.lambdaLoad,
      liquidityTier: def.liquidityTier,
      lockupMonths: def.lockupMonths,
      visible: true,
      emphasized: false,
      details: parsed.details,
    })
  }

  return { instruments, skipped, matched: sectionsSeen, unmatched: [] }
}
