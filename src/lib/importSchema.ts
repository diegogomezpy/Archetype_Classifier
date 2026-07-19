import { fieldSpecsFor, type ManagedInstrument } from './catalog'
import type { Category, Region } from './instruments'
import { deriveDefaults, deriveRiskVector } from './riskDerivation'
import { toCsv } from './csv'

// ---------------------------------------------------------------------------
// Import schema
// ---------------------------------------------------------------------------
// The full set of columns for loading one asset class from a spreadsheet: the
// core identity/risk fields plus that class's detail fields. Each column lists
// the header names it accepts — our own label AND common Bloomberg export names —
// so a filled template OR a raw Bloomberg dump both map without manual fixup.
// An import is scoped to a chosen region + category, so those aren't columns.

export type ImportColumn = {
  key: string // ManagedInstrument field or details[] key
  label: string // template header
  aliases: string[] // extra accepted headers (case/space/punct-insensitive)
  required?: boolean
  derived?: boolean // auto-derived when left blank (risk vectors)
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

// Bloomberg-ish header aliases keyed by our field/detail key.
const ALIASES: Record<string, string[]> = {
  name: ['security', 'security name', 'issuer name', 'long name', 'short name'],
  isin: ['id isin', 'isin number'],
  ticker: ['bbg ticker', 'bloomberg ticker', 'symbol', 'ticker symbol'],
  kind: ['type', 'security type', 'instrument type', 'sec type', 'type of security'],
  currency: ['crncy', 'ccy', 'curr'],
  // detail keys
  // Bond listing headers, as the research firm prints them (Spanish, abbreviated).
  issuer: ['issuer name', 'obligor', 'emisor'],
  sector: ['sector', 'industry', 'industria'],
  country: ['country', 'pais', 'país', 'domicile'],
  bid: ['bid', 'bid price', 'precio bid'],
  ask: ['ask', 'ask price', 'offer', 'precio ask'],
  ytmBid: ['ytm bid', 'yield bid', 'rendimiento bid'],
  // A generic "YTM" is the ask/offer side — the yield a client buying actually gets.
  ytmAsk: ['ytm ask', 'ytm', 'yield to maturity', 'yld ytm mid', 'rendimiento', 'yield ask'],
  ytc: ['ytc', 'yield to call', 'rendimiento al call'],
  nextCall: ['prox call', 'próx. call', 'prox. call', 'next call', 'call date', 'fecha call'],
  rating: ['rtg', 'credit rating', 'sp rating', 's&p rating', 'rtg sp', 'bb composite'],
  creditRating: ['rating', 'rtg', 'sp rating', 's&p rating', 'credit rating'],
  couponRate: ['coupon', 'cpn', 'coupon rate'],
  couponFrequency: ['coupon frequency', 'cpn freq', 'cpn frequency', 'payment frequency'],
  maturity: ['maturity date', 'mty', 'mtty', 'final maturity', 'vencimiento', 'venc'],
  duration: ['modified duration', 'dur adj mid', 'mod duration', 'dur'],
  ytm: ['yield to maturity', 'yld ytm mid', 'yield'],
  estYield: ['yield', 'yld', 'estimated yield', 'rendimiento'],
  lastPrice: ['px last', 'price', 'last', 'last price'],
  change1Y: ['1y return', 'total return 1y', 'chg 1y'],
  marketCapAum: ['market cap', 'cur mkt cap', 'market capitalization', 'aum'],
  marketCap: ['market cap', 'cur mkt cap', 'market capitalization'],
  dividendYield: ['div yield', 'eqy dvd yld ind', 'dividend yield'],
  peRatio: ['pe', 'p/e', 'pe ratio', 'price earnings'],
  beta: ['beta raw', 'equity beta', 'adjusted beta'],
  sectorIndex: ['sector', 'gics sector', 'industry', 'index'],
  exchange: ['exch code', 'primary exchange', 'listing exchange'],
  impliedVol3m: ['implied vol', 'ivol', '3m implied vol', 'atm vol'],
  avgVolume: ['avg volume', 'volume avg 30d', 'average volume'],
  expenseRatio: ['expense ratio', 'fund expense ratio', 'ter'],
  maturityMonths: ['tenor', 'term months', 'maturity months'],
  sigmaLoad: ['sigma', 'σ', 'variance load'],
  alphaLoad: ['alpha', 'α', 'skew load'],
  lambdaLoad: ['lambda', 'λ', 'loss load'],
  liquidityTier: ['liquidity', 'liquidity tier'],
  lockupMonths: ['lockup', 'lock-up', 'lockup months'],
}

// Core identity + risk columns present for every class.
function coreColumns(): ImportColumn[] {
  return [
    { key: 'name', label: 'Name', aliases: ALIASES.name, required: true },
    { key: 'kind', label: 'Type', aliases: ALIASES.kind },
    { key: 'isin', label: 'ISIN', aliases: ALIASES.isin },
    { key: 'ticker', label: 'Ticker', aliases: ALIASES.ticker },
    { key: 'currency', label: 'Currency', aliases: ALIASES.currency },
    { key: 'sigmaLoad', label: 'σ (sigma)', aliases: ALIASES.sigmaLoad, derived: true },
    { key: 'alphaLoad', label: 'α (alpha)', aliases: ALIASES.alphaLoad, derived: true },
    { key: 'lambdaLoad', label: 'λ (lambda)', aliases: ALIASES.lambdaLoad, derived: true },
    { key: 'liquidityTier', label: 'Liquidity tier (1-4)', aliases: ALIASES.liquidityTier, derived: true },
    { key: 'lockupMonths', label: 'Lock-up (months)', aliases: ALIASES.lockupMonths, derived: true },
    { key: 'visible', label: 'Visible', aliases: [] },
    { key: 'emphasized', label: 'House pick', aliases: ['emphasized', 'featured'] },
  ]
}

/**
 * Classes where market data can fill everything from a ticker alone. For these
 * the template collapses to what a human actually has to supply — the ticker and
 * the research firm's rationale — and the import fetches the rest.
 */
export function isAutoFillable(region: Region, category: Category): boolean {
  return region === 'global' && (category === 'Equities' || category === 'Crypto')
}

const AUTOFILL_COLUMNS: ImportColumn[] = [
  { key: 'ticker', label: 'Ticker', aliases: ALIASES.ticker, required: true },
  {
    key: 'description',
    label: 'Descripción',
    aliases: ['description', 'rationale', 'thesis', 'racional', 'comentario'],
  },
]

/** All import columns for a class: core identity/risk + that class's details. */
export function importColumnsFor(region: Region, category: Category): ImportColumn[] {
  if (isAutoFillable(region, category)) return AUTOFILL_COLUMNS
  // Bonds are OTC — they have an ISIN, never an exchange ticker.
  const dropTicker = category === 'Fixed income' || category === 'CDs'
  const detail = fieldSpecsFor(region, category)
    .filter((fs) => fs.key !== 'asOf')
    .map<ImportColumn>((fs) => ({
      key: fs.key,
      label: fs.en,
      aliases: [fs.key, ...(ALIASES[fs.key] ?? [])],
    }))
  // 'currency' lives in core; drop a duplicate detail currency column if present.
  const seen = new Set(['currency'])
  const detailUnique = detail.filter((c) => !seen.has(c.key) && (seen.add(c.key), true))
  const core = dropTicker ? coreColumns().filter((c) => c.key !== 'ticker') : coreColumns()
  return [...core, ...detailUnique]
}

/**
 * Map a CSV header row to our column keys: header index → column key. Matches on
 * a normalized form of the label + every alias, so "Coupon Rate", "cpn", and
 * "couponRate" all resolve to the same field.
 */
export function matchHeaders(headers: string[], columns: ImportColumn[]): Map<number, string> {
  const lookup = new Map<string, string>()
  for (const c of columns) {
    for (const name of [c.label, c.key, ...c.aliases]) lookup.set(norm(name), c.key)
  }
  const out = new Map<number, string>()
  headers.forEach((h, i) => {
    const key = lookup.get(norm(h))
    if (key) out.set(i, key)
  })
  return out
}

// ── Parsing rows into instruments ────────────────────────────────────────────

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48)
const numOr = (v?: string): number | null => {
  const n = parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, ''))
  return Number.isFinite(n) ? n : null
}
const truthy = (v: string | undefined, dflt: boolean): boolean =>
  v && v.trim() ? /^(y|yes|true|1|s[ií]|x|visible)$/i.test(v.trim()) : dflt

/**
 * A bond listing has no Name column — the issuer is the name. Compose the
 * conventional bond label (issuer + coupon + maturity) so that several series
 * from the same issuer stay distinguishable: a listing typically carries three
 * NETFLIX lines that would otherwise all read "NETFLIX INC".
 */
function composeName(v: Record<string, string>): string {
  const issuer = (v.issuer ?? '').trim()
  if (!issuer) return ''
  const coupon = (v.couponRate ?? '').trim().replace(/%\s*$/, '')
  const maturity = (v.maturity ?? '').trim()
  return [issuer, coupon && `${coupon}%`, maturity].filter(Boolean).join(' ')
}

export type ImportResult = {
  instruments: ManagedInstrument[]
  skipped: number // rows dropped (no name)
  matched: string[] // header labels we mapped
  unmatched: string[] // headers we ignored
}

/** Build instruments from parsed CSV rows for a chosen region + category. */
export function parseInstruments(region: Region, category: Category, rows: string[][]): ImportResult {
  if (rows.length < 2) return { instruments: [], skipped: 0, matched: [], unmatched: [] }
  const columns = importColumnsFor(region, category)
  const headers = rows[0]
  const map = matchHeaders(headers, columns)
  const labelFor = new Map(columns.map((c) => [c.key, c.label]))
  const matched = [...new Set(map.values())].map((k) => labelFor.get(k) ?? k)
  const unmatched = headers.filter((h, i) => h.trim() !== '' && !map.has(i))
  const detailKeys = new Set(fieldSpecsFor(region, category).map((fs) => fs.key))
  const autoFill = isAutoFillable(region, category)

  const seen = new Set<string>()
  const instruments: ManagedInstrument[] = []
  let skipped = 0
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r]
    const v: Record<string, string> = {}
    map.forEach((key, i) => {
      const val = (cells[i] ?? '').trim()
      if (val) v[key] = val
    })
    // Auto-fillable classes are keyed by ticker; the real name arrives with the
    // market data, so fall back to the ticker until then. Bond listings carry no
    // Name column at all — the issuer is the name (see composeName).
    const name =
      (v.name ?? '').trim() ||
      (autoFill ? (v.ticker ?? '').trim().toUpperCase() : '') ||
      composeName(v)
    if (!name) {
      skipped++
      continue
    }
    const details: Record<string, string> = {}
    for (const k of detailKeys) if (v[k]) details[k] = v[k]
    if (v.currency) details.currency = v.currency

    const derived = deriveRiskVector(region, category, details)
    const def = deriveDefaults(region, category)
    const sigma = numOr(v.sigmaLoad)
    const alpha = numOr(v.alphaLoad)
    const lambda = numOr(v.lambdaLoad)
    const lt = numOr(v.liquidityTier)

    let id = `imp-${region}-${slug(category)}-${slug(v.isin || name)}`
    while (seen.has(id)) id += 'x'
    seen.add(id)

    instruments.push({
      id,
      name,
      ticker: (v.ticker ?? '').trim(),
      isin: v.isin?.trim() || undefined,
      kind: v.kind?.trim() || undefined,
      region,
      assetClass: category,
      sigmaLoad: sigma ?? derived.sigmaLoad,
      alphaLoad: alpha ?? derived.alphaLoad,
      lambdaLoad: lambda ?? derived.lambdaLoad,
      liquidityTier: (lt && lt >= 1 && lt <= 4 ? Math.round(lt) : def.liquidityTier) as 1 | 2 | 3 | 4,
      lockupMonths: numOr(v.lockupMonths) ?? def.lockupMonths,
      visible: truthy(v.visible, true),
      emphasized: truthy(v.emphasized, false),
      details,
    })
  }
  return { instruments, skipped, matched, unmatched }
}

/** A header-only CSV template for the chosen class. */
export function templateCsv(region: Region, category: Category): string {
  return toCsv([importColumnsFor(region, category).map((c) => c.label)])
}

