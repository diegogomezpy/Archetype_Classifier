import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  INSTRUMENTS,
  type AssetClass,
  type Category,
  type Instrument,
  type LocalCategory,
  type Region,
} from './instruments'
import { SEED_DETAILS } from '../data/instrumentDetails'
import type { Lang } from '../i18n/i18n'
import { api } from './api'

// ---------------------------------------------------------------------------
// Managed instrument catalog
// ---------------------------------------------------------------------------
// The admin-curated universe of offerable instruments. The bundled INSTRUMENTS
// list seeds the catalog on first run; every edit (risk vectors, visibility,
// emphasis, per-class details) persists behind an async store interface so the
// Firestore backend can swap in later without touching UI code.

export type ManagedInstrument = Instrument & {
  id: string
  isin?: string // optional identifier; used (with the ticker) for data autofill
  visible: boolean // hidden instruments never surface in recommendations
  emphasized: boolean // "house pick": pinned to the top of its class tab
  details: Record<string, string> // per-class fields, keyed by FieldSpec.key
  updatedAt?: string
}

// ── Per-asset-class information schema ──────────────────────────────────────
// One FieldSpec per datum the advisor should have at hand for an instrument of
// that class. The admin edit form renders exactly these fields; the advisor
// dashboard's detail panel shows the filled ones in this order. Units live in
// the labels so values stay plain strings. `description` opens and `asOf`
// closes every class.
export type FieldSpec = { key: string; en: string; es: string }

const DESCRIPTION: FieldSpec = { key: 'description', en: 'Description', es: 'Descripción' }
// The research firm's own view — distinct from the fetched description, and
// never overwritten by a market-data refresh.
const RATIONALE: FieldSpec = { key: 'rationale', en: 'Investment rationale', es: 'Racional de inversión' }
const AS_OF: FieldSpec = { key: 'asOf', en: 'Data as of', es: 'Datos al' }

export const ASSET_FIELD_SPECS: Record<AssetClass, FieldSpec[]> = {
  Equities: [
    RATIONALE,
    DESCRIPTION,
    { key: 'kind', en: 'Type (single stock / ETF)', es: 'Tipo (acción ordinaria / ETF)' },
    { key: 'sectorIndex', en: 'Sector / index tracked', es: 'Sector / índice replicado' },
    { key: 'exchange', en: 'Exchange', es: 'Bolsa' },
    { key: 'lastPrice', en: 'Last price (USD)', es: 'Último precio (USD)' },
    { key: 'change1Y', en: '1-year change (%)', es: 'Variación 1 año (%)' },
    { key: 'range52w', en: '52-week range (USD)', es: 'Rango 52 semanas (USD)' },
    { key: 'avgVolume', en: 'Avg. daily volume', es: 'Volumen diario promedio' },
    { key: 'marketCapAum', en: 'Market cap / AUM', es: 'Capitalización / AUM' },
    { key: 'dividendYield', en: 'Dividend yield (%)', es: 'Rendimiento por dividendo (%)' },
    { key: 'peRatio', en: 'P/E ratio (stocks)', es: 'Ratio P/E (acciones)' },
    { key: 'peForward', en: 'P/E forward (est.)', es: 'P/E estimado' },
    { key: 'expenseRatio', en: 'Expense ratio (%, ETFs)', es: 'Comisión de gestión (%, ETFs)' },
    // Street consensus — all fetched; the research firm only sends the rationale.
    { key: 'priceTarget', en: 'Price target', es: 'Precio objetivo' },
    { key: 'potentialReturn', en: 'Potential return (%)', es: 'Retorno potencial (%)' },
    { key: 'recBuyPct', en: 'Buy recommendations (%)', es: 'Recomendaciones de compra (%)' },
    { key: 'recHoldPct', en: 'Hold recommendations (%)', es: 'Recomendaciones de mantener (%)' },
    { key: 'recSellPct', en: 'Sell recommendations (%)', es: 'Recomendaciones de venta (%)' },
    { key: 'analystCount', en: 'Analysts covering', es: 'Analistas que cubren' },
    { key: 'beta', en: 'Beta vs. market', es: 'Beta vs. mercado' },
    { key: 'impliedVol3m', en: 'ATM 3M implied vol (%)', es: 'Vol. implícita ATM 3M (%)' },
    AS_OF,
  ],
  'Fixed income': [
    // Global fixed income holds BOTH liquid bond ETFs (ticker → Yahoo fills the
    // ETF block) AND individual bonds (the firm fills the mirror block). It's a
    // superset — each instrument shows only its filled fields.
    RATIONALE,
    DESCRIPTION,
    { key: 'kind', en: 'Type (ETF / bond)', es: 'Tipo (ETF / bono)' },
    // ── ETF block (fetched from the ticker) ──
    { key: 'sectorIndex', en: 'Index tracked (ETFs)', es: 'Índice replicado (ETFs)' },
    { key: 'exchange', en: 'Exchange (ETFs)', es: 'Bolsa (ETFs)' },
    { key: 'lastPrice', en: 'Last price (USD)', es: 'Último precio (USD)' },
    { key: 'change1Y', en: '1-year change (%)', es: 'Variación 1 año (%)' },
    { key: 'range52w', en: '52-week range (USD)', es: 'Rango 52 semanas (USD)' },
    { key: 'dividendYield', en: 'Yield (%)', es: 'Rendimiento (%)' },
    { key: 'expenseRatio', en: 'Expense ratio (%, ETFs)', es: 'Comisión de gestión (%, ETFs)' },
    { key: 'avgVolume', en: 'Avg. daily volume', es: 'Volumen diario promedio' },
    { key: 'marketCapAum', en: 'AUM', es: 'Patrimonio (AUM)' },
    // ── Individual-bond mirror — Gletir's "Listado de Bonos" columns, 1:1 and in
    // their order (ISIN · EMISOR · SECTOR · PAÍS · BID · ASK · YTM BID · YTM ASK ·
    // CPN · DUR · VENC · RTG · YTC · PRÓX. CALL), plus SPREAD for floating-rate
    // notes and the TIPS breakeven. None of it is on any free feed, so the firm
    // fills all of it. (Coupon frequency / min piece / currency aren't in the
    // listing — dropped so a Gletir paste maps 1:1.) ──
    { key: 'issuer', en: 'Issuer', es: 'Emisor' },
    { key: 'sector', en: 'Sector', es: 'Sector' },
    { key: 'country', en: 'Country', es: 'País' },
    { key: 'bid', en: 'Bid', es: 'Bid' },
    { key: 'ask', en: 'Ask', es: 'Ask' },
    { key: 'ytmBid', en: 'YTM bid (%)', es: 'YTM bid (%)' },
    { key: 'ytmAsk', en: 'YTM ask (%)', es: 'YTM ask (%)' },
    { key: 'couponRate', en: 'Coupon (%)', es: 'Cupón (%)' },
    { key: 'duration', en: 'Duration (years)', es: 'Duración (años)' },
    { key: 'maturity', en: 'Maturity', es: 'Vencimiento' },
    { key: 'creditRating', en: 'Credit rating', es: 'Calificación' },
    { key: 'ytc', en: 'Yield to call (%)', es: 'Rendimiento al call (%)' },
    { key: 'nextCall', en: 'Next call date', es: 'Próx. call' },
    // Floating-rate notes only: the reference index the coupon floats over, and
    // the spread added to it. TIPS only: the breakeven inflation. Gated by the
    // subclass so they never show on a plain fixed-rate bond.
    { key: 'referenceRate', en: 'Reference rate', es: 'Tasa de referencia' },
    { key: 'spread', en: 'Floating spread (%)', es: 'Spread flotante (%)' },
    { key: 'impliedInflation', en: 'Breakeven inflation (%)', es: 'Inflación implícita (%)' },
    AS_OF,
  ],
  'Income structures': [
    DESCRIPTION,
    { key: 'underlying', en: 'Underlying(s)', es: 'Subyacente(s)' },
    { key: 'couponYield', en: 'Coupon / premium (% p.a.)', es: 'Cupón / prima (% anual)' },
    { key: 'barrier', en: 'Protection barrier (% of initial)', es: 'Barrera de protección (% del inicial)' },
    { key: 'autocallLevel', en: 'Autocall level (%)', es: 'Nivel de autocall (%)' },
    { key: 'observationFrequency', en: 'Observation frequency', es: 'Frecuencia de observación' },
    { key: 'maturityMonths', en: 'Maturity (months)', es: 'Plazo (meses)' },
    { key: 'issuer', en: 'Issuer', es: 'Emisor' },
    { key: 'issuerRating', en: 'Issuer credit rating', es: 'Calificación del emisor' },
    { key: 'capitalProtection', en: 'Capital protection', es: 'Protección del capital' },
    { key: 'worstCase', en: 'Worst-case scenario', es: 'Peor escenario' },
    AS_OF,
  ],
  'Growth structures': [
    DESCRIPTION,
    { key: 'underlying', en: 'Underlying(s)', es: 'Subyacente(s)' },
    { key: 'participationRate', en: 'Participation rate (%)', es: 'Tasa de participación (%)' },
    { key: 'cap', en: 'Upside cap (% or uncapped)', es: 'Tope de ganancia (% o sin tope)' },
    { key: 'protectionLevel', en: 'Protection level (% of capital)', es: 'Nivel de protección (% del capital)' },
    { key: 'maturityMonths', en: 'Maturity (months)', es: 'Plazo (meses)' },
    { key: 'issuer', en: 'Issuer', es: 'Emisor' },
    { key: 'issuerRating', en: 'Issuer credit rating', es: 'Calificación del emisor' },
    { key: 'worstCase', en: 'Worst-case scenario', es: 'Peor escenario' },
    AS_OF,
  ],
  Alternatives: [
    DESCRIPTION,
    { key: 'exposure', en: 'Underlying exposure', es: 'Exposición subyacente' },
    { key: 'expenseRatio', en: 'Expense ratio (%)', es: 'Comisión de gestión (%)' },
    { key: 'distributionYield', en: 'Distribution yield (%)', es: 'Rendimiento de distribución (%)' },
    { key: 'avgVolume', en: 'Avg. daily volume', es: 'Volumen diario promedio' },
    { key: 'diversificationNote', en: 'Diversification role', es: 'Rol de diversificación' },
    AS_OF,
  ],
  Crypto: [
    RATIONALE,
    DESCRIPTION,
    { key: 'kind', en: 'Type (coin / ETP)', es: 'Tipo (moneda / ETP)' },
    { key: 'lastPrice', en: 'Last price (USD)', es: 'Último precio (USD)' },
    { key: 'change1Y', en: '1-year change (%)', es: 'Variación 1 año (%)' },
    { key: 'range52w', en: '52-week range (USD)', es: 'Rango 52 semanas (USD)' },
    { key: 'marketCap', en: 'Market cap', es: 'Capitalización de mercado' },
    { key: 'marketCapAum', en: 'AUM (ETP)', es: 'Patrimonio (ETP)' },
    { key: 'expenseRatio', en: 'Expense ratio (%, ETP)', es: 'Comisión de gestión (%, ETP)' },
    { key: 'avgVolume', en: 'Avg. daily volume', es: 'Volumen diario promedio' },
    { key: 'custodyForm', en: 'Custody / wrapper', es: 'Custodia / vehículo' },
    { key: 'impliedVol3m', en: 'ATM 3M implied vol (%)', es: 'Vol. implícita ATM 3M (%)' },
    { key: 'volatilityNote', en: 'Volatility / drawdown note', es: 'Nota de volatilidad / caídas' },
    AS_OF,
  ],
  'Cash/MMF': [
    DESCRIPTION,
    { key: 'currentYield', en: 'Current yield (%)', es: 'Rendimiento actual (%)' },
    { key: 'avgMaturityDays', en: 'Avg. maturity (days)', es: 'Vencimiento promedio (días)' },
    { key: 'minInvestment', en: 'Minimum investment', es: 'Inversión mínima' },
    { key: 'expenseRatio', en: 'Expense ratio (%)', es: 'Comisión de gestión (%)' },
    AS_OF,
  ],
}

// ── Per-local-category information schema ───────────────────────────────────
// Local (Cadiem) instruments carry the fields the bulletin publishes: issuer,
// rating, estimated yield, coupon frequency, maturity, currency, minimum, etc.
const ISSUER: FieldSpec = { key: 'issuer', en: 'Issuer', es: 'Emisor' }
const RATING: FieldSpec = { key: 'rating', en: 'Credit rating', es: 'Calificación' }
const CURRENCY: FieldSpec = { key: 'currency', en: 'Currency', es: 'Moneda' }

export const LOCAL_FIELD_SPECS: Record<LocalCategory, FieldSpec[]> = {
  'Fixed income': [
    DESCRIPTION,
    ISSUER,
    RATING,
    { key: 'estYield', en: 'Estimated yield (%)', es: 'Rendimiento estimado (%)' },
    { key: 'couponFrequency', en: 'Interest payment', es: 'Pago de intereses' },
    { key: 'maturity', en: 'Maturity', es: 'Vencimiento' },
    { key: 'residualYears', en: 'Residual term (years)', es: 'Plazo residual (años)' },
    { key: 'available', en: 'Amount available', es: 'Disponibilidad' },
    CURRENCY,
    AS_OF,
  ],
  CDs: [
    DESCRIPTION,
    ISSUER,
    RATING,
    { key: 'estYield', en: 'Estimated yield (%)', es: 'Rendimiento estimado (%)' },
    { key: 'couponFrequency', en: 'Interest payment', es: 'Pago de intereses' },
    { key: 'maturity', en: 'Maturity', es: 'Vencimiento' },
    { key: 'residualYears', en: 'Residual term (years)', es: 'Plazo residual (años)' },
    { key: 'cuts', en: 'Cuts', es: 'Cantidad de cortes' },
    CURRENCY,
    AS_OF,
  ],
  Equities: [
    DESCRIPTION,
    ISSUER,
    RATING,
    { key: 'shareClass', en: 'Class', es: 'Clase' },
    { key: 'shareType', en: 'Share type', es: 'Tipo de acción' },
    { key: 'estYield', en: 'Estimated yield (%)', es: 'Rendimiento estimado (%)' },
    { key: 'price', en: 'Price', es: 'Precio' },
    { key: 'available', en: 'Amount available', es: 'Disponibilidad' },
    CURRENCY,
    AS_OF,
  ],
  'Mutual funds': [
    DESCRIPTION,
    { key: 'fundManager', en: 'Manager', es: 'Administradora' },
    RATING,
    { key: 'estYield', en: 'Estimated return (%)', es: 'Rendimiento estimado (%)' },
    { key: 'horizon', en: 'Horizon', es: 'Horizonte' },
    { key: 'dividendPayment', en: 'Income payment', es: 'Pago de rendimientos' },
    { key: 'redemption', en: 'Redemption', es: 'Pago de rescates' },
    { key: 'minInvestment', en: 'Minimum investment', es: 'Inversión mínima' },
    CURRENCY,
    AS_OF,
  ],
  'Investment funds': [
    DESCRIPTION,
    { key: 'fundManager', en: 'Manager', es: 'Administradora' },
    { key: 'estYield', en: 'Estimated return (%)', es: 'Rendimiento estimado (%)' },
    { key: 'dividendPayment', en: 'Dividend payment', es: 'Pago de dividendos' },
    { key: 'shareValue', en: 'Share value', es: 'Valor cuota' },
    { key: 'saleValue', en: 'Sale value', es: 'Valor de venta' },
    { key: 'term', en: 'Term', es: 'Plazo' },
    { key: 'minInvestment', en: 'Minimum investment', es: 'Inversión mínima' },
    CURRENCY,
    AS_OF,
  ],
}

// ── Subclasses (class → subclass taxonomy) ──────────────────────────────────
// Every class splits into subclasses — the instrument's `kind`. The subclass
// decides which of the class's fields (the union above) are shown/imported and
// whether market data can autofill it: a floating-rate note shows its reference
// rate and spread, a TIPS shows breakeven inflation, and a plain fixed-rate
// bond shows neither. `keys` are the detail keys the subclass surfaces (on top
// of the always-on base); `all` means the whole class union (a not-yet-split
// class). `fetch` lists the keys autofill can fill — absent ⇒ manual only.
// `aliases` are keywords an imported free-typed Type tag is matched against.
export type Subclass = {
  id: string // canonical value stored on ManagedInstrument.kind
  en: string
  es: string
  keys?: string[]
  all?: boolean
  fetch?: string[]
  aliases?: string[]
  // A generic catch-all subclass (e.g. plain fixed-rate bond) that should only
  // win an import Type match when no more-specific subclass matched — so
  // "Bono flotante" resolves to Floating-rate, not the generic bond.
  fallback?: boolean
}

// Always shown, whatever the subclass (rationale/description open, asOf closes;
// kind is handled specially by the form and import).
const BASE_KEYS = ['rationale', 'description', 'kind', 'asOf']

// Reusable key groups the subclasses compose from.
const EQ_MARKET = ['sectorIndex', 'exchange', 'lastPrice', 'change1Y', 'range52w', 'avgVolume', 'marketCapAum', 'dividendYield']
const EQ_ANALYST = ['priceTarget', 'potentialReturn', 'recBuyPct', 'recHoldPct', 'recSellPct', 'analystCount']
const BOND_MIRROR = ['issuer', 'sector', 'country', 'bid', 'ask', 'ytmBid', 'ytmAsk', 'couponRate', 'duration', 'maturity', 'creditRating', 'ytc', 'nextCall']
const BOND_ETF_KEYS = ['sectorIndex', 'exchange', 'lastPrice', 'change1Y', 'range52w', 'dividendYield', 'expenseRatio', 'avgVolume', 'marketCapAum']

// What autofill can fill per equity/bond subclass (⊆ FETCHABLE_FIELDS below).
const EQ_FETCH = ['description', 'kind', 'sectorIndex', 'exchange', 'lastPrice', 'change1Y', 'range52w', 'avgVolume', 'marketCapAum', 'dividendYield', 'peRatio', 'peForward', 'beta', 'impliedVol3m', 'priceTarget', 'potentialReturn', 'recBuyPct', 'recHoldPct', 'recSellPct', 'analystCount', 'asOf']
const ETF_FETCH = ['description', 'kind', 'sectorIndex', 'exchange', 'lastPrice', 'change1Y', 'range52w', 'avgVolume', 'marketCapAum', 'dividendYield', 'beta', 'asOf']
const PREF_FETCH = ['description', 'kind', 'sectorIndex', 'exchange', 'lastPrice', 'change1Y', 'range52w', 'avgVolume', 'marketCapAum', 'dividendYield', 'beta', 'asOf']
const COIN_FETCH = ['description', 'lastPrice', 'change1Y', 'marketCap', 'avgVolume', 'impliedVol3m', 'asOf']

const GLOBAL_SUBCLASSES: Partial<Record<AssetClass, Subclass[]>> = {
  Equities: [
    { id: 'Acción Ordinaria', en: 'Common stock', es: 'Acción Ordinaria', keys: [...EQ_MARKET, 'peRatio', 'peForward', 'beta', 'impliedVol3m', ...EQ_ANALYST], fetch: EQ_FETCH, aliases: ['common', 'ordinaria', 'single stock', 'single', 'stock', 'accion', 'acción'] },
    { id: 'Acción Preferida', en: 'Preferred stock', es: 'Acción Preferida', keys: [...EQ_MARKET, 'beta'], fetch: PREF_FETCH, aliases: ['preferred', 'preferida', 'preferente', 'preferid'] },
    { id: 'ETF', en: 'Equity ETF', es: 'ETF de acciones', keys: [...EQ_MARKET, 'expenseRatio', 'beta'], fetch: ETF_FETCH, aliases: ['etf', 'fund', 'index'] },
  ],
  'Fixed income': [
    { id: 'Bond ETF', en: 'Bond ETF', es: 'ETF de bonos', keys: BOND_ETF_KEYS, fetch: ETF_FETCH, aliases: ['bond etf', 'etf', 'fund'] },
    { id: 'Fixed-rate bond', en: 'Fixed-rate bond', es: 'Bono tasa fija', keys: BOND_MIRROR, fallback: true, aliases: ['bono', 'bond', 'fixed', 'fija', 'corporate', 'corporativo', 'sovereign', 'soberano', 'treasury', 'bill'] },
    { id: 'TIPS', en: 'Inflation-linked (TIPS)', es: 'Indexado a inflación (TIPS)', keys: ['issuer', 'sector', 'country', 'bid', 'ask', 'ytmBid', 'ytmAsk', 'couponRate', 'duration', 'maturity', 'creditRating', 'impliedInflation'], aliases: ['tips', 'inflation', 'inflacion', 'inflación', 'linker', 'indexado'] },
    { id: 'Floating-rate', en: 'Floating-rate note', es: 'Bono tasa variable', keys: ['issuer', 'sector', 'country', 'bid', 'ask', 'ytmBid', 'ytmAsk', 'referenceRate', 'spread', 'duration', 'maturity', 'creditRating'], aliases: ['float', 'floating', 'variable', 'flotante', 'frn'] },
  ],
  Crypto: [
    { id: 'Crypto', en: 'Coin / token', es: 'Moneda / token', keys: ['lastPrice', 'change1Y', 'marketCap', 'avgVolume', 'custodyForm', 'impliedVol3m', 'volatilityNote'], fetch: COIN_FETCH, aliases: ['coin', 'token', 'spot', 'cripto', 'crypto'] },
    { id: 'Crypto ETP', en: 'Crypto ETP / trust', es: 'ETP / fondo cripto', keys: ['lastPrice', 'change1Y', 'range52w', 'marketCapAum', 'expenseRatio', 'avgVolume', 'custodyForm'], fetch: COIN_FETCH, aliases: ['etp', 'etf', 'trust', 'fund'] },
  ],
  // Not yet split — one default subclass each, showing the whole class union.
  'Income structures': [{ id: 'Income structure', en: 'Income structure', es: 'Estructura de renta', all: true }],
  'Growth structures': [{ id: 'Growth structure', en: 'Growth structure', es: 'Estructura de crecimiento', all: true }],
  Alternatives: [{ id: 'Alternative', en: 'Alternative', es: 'Alternativo', all: true }],
  'Cash/MMF': [{ id: 'Cash / MMF', en: 'Cash / MMF', es: 'Efectivo / FMM', all: true }],
}

const LOCAL_SUBCLASSES: Partial<Record<LocalCategory, Subclass[]>> = {
  Equities: [
    { id: 'Acción Ordinaria', en: 'Common stock', es: 'Acción Ordinaria', keys: ['issuer', 'rating', 'shareClass', 'estYield', 'price', 'available', 'currency'], aliases: ['common', 'ordinaria'] },
    { id: 'Acción Preferida', en: 'Preferred stock', es: 'Acción Preferida', keys: ['issuer', 'rating', 'shareClass', 'estYield', 'price', 'available', 'currency'], aliases: ['preferred', 'preferida', 'preferente', 'prefer'] },
  ],
  'Fixed income': [
    { id: 'Bono corporativo', en: 'Corporate bond', es: 'Bono corporativo', all: true, aliases: ['corporativo', 'corporate', 'corp'] },
    { id: 'Bono soberano', en: 'Sovereign bond', es: 'Bono soberano', all: true, aliases: ['soberano', 'sovereign'] },
  ],
  CDs: [{ id: 'CDA', en: 'Certificate of deposit', es: 'CDA', all: true }],
  'Mutual funds': [{ id: 'Fondo mutuo', en: 'Mutual fund', es: 'Fondo mutuo', all: true }],
  'Investment funds': [{ id: 'Fondo de inversión', en: 'Investment fund', es: 'Fondo de inversión', all: true }],
}

/** The subclasses offered for a region + class (the admin form's Type dropdown). */
export function subclassesFor(region: Region, category: Category): Subclass[] {
  return region === 'local'
    ? LOCAL_SUBCLASSES[category as LocalCategory] ?? []
    : GLOBAL_SUBCLASSES[category as AssetClass] ?? []
}

const normSub = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

/** Resolve an instrument's `kind` to its subclass (id, then label, then alias). */
export function subclassFor(region: Region, category: Category, kind?: string): Subclass | undefined {
  if (!kind) return undefined
  const subs = subclassesFor(region, category)
  const k = normSub(kind)
  return (
    subs.find((s) => normSub(s.id) === k) ??
    subs.find((s) => normSub(s.en) === k || normSub(s.es) === k) ??
    subs.find((s) => (s.aliases ?? []).some((a) => normSub(a) === k))
  )
}

/**
 * Resolve a free-typed import Type tag to a subclass id. After an exact match,
 * it picks the MOST-SPECIFIC alias hit — a non-fallback subclass always beats a
 * `fallback` one, and among the same tier the longest matching alias wins — so
 * "Bono flotante" → Floating-rate (not the generic Fixed-rate bond) and
 * "Acción Preferente" → Preferred (not Common). Undefined when nothing matches.
 */
export function resolveSubclassId(region: Region, category: Category, raw?: string): string | undefined {
  const exact = subclassFor(region, category, raw)
  if (exact) return exact.id
  if (!raw) return undefined
  const k = normSub(raw)
  let best: { id: string; specific: boolean; len: number } | null = null
  for (const s of subclassesFor(region, category)) {
    for (const a of s.aliases ?? []) {
      const na = normSub(a)
      if (!na || !k.includes(na)) continue
      const cand = { id: s.id, specific: !s.fallback, len: na.length }
      if (
        !best ||
        (cand.specific && !best.specific) ||
        (cand.specific === best.specific && cand.len > best.len)
      )
        best = cand
    }
  }
  return best?.id
}

/**
 * The detail-field schema for an instrument, by region + class, narrowed to the
 * subclass when `kind` resolves to one. Without a kind (or a not-yet-split
 * class) it returns the full class union — which is also what an import template
 * uses, since one file can mix subclasses.
 */
export function fieldSpecsFor(region: Region, category: Category, kind?: string): FieldSpec[] {
  const union =
    region === 'local'
      ? LOCAL_FIELD_SPECS[category as LocalCategory] ?? []
      : ASSET_FIELD_SPECS[category as AssetClass] ?? []
  const sub = subclassFor(region, category, kind)
  if (!sub || sub.all) return union
  const show = new Set([...BASE_KEYS, ...(sub.keys ?? [])])
  return union.filter((f) => show.has(f.key))
}

// ── Localized values ─────────────────────────────────────────────────────────
// The market-data feed pulls free-text fields in English (company description,
// sector). Their Spanish translations are cached at fetch time under `<key>Es`
// (see server/src/translate.ts). Pick the right one for the active language,
// falling back to the English text when no translation is cached yet.
export const localizedDetail = (
  details: Record<string, string>,
  key: string,
  lang: Lang,
): string => {
  const en = details[key] ?? ''
  if (lang !== 'es') return en
  const es = details[`${key}Es`]
  return es && es.trim() ? es : en
}

// Display labels (EN + ES) for the canonical `kind` values, built from the
// subclass registry so labels never drift from the taxonomy. Legacy free-typed
// values ('Single stock', 'Acción', 'Bono') alias to the merged type so
// pre-refactor data still renders; anything unmapped passes through unchanged.
const KIND_LABELS: Record<string, { en: string; es: string }> = (() => {
  const m: Record<string, { en: string; es: string }> = {}
  for (const subs of [...Object.values(GLOBAL_SUBCLASSES), ...Object.values(LOCAL_SUBCLASSES)]) {
    for (const s of subs ?? []) m[s.id] = { en: s.en, es: s.es }
  }
  // legacy → current
  m['Single stock'] = { en: 'Common stock', es: 'Acción Ordinaria' }
  m['Acción'] = { en: 'Common stock', es: 'Acción Ordinaria' }
  m['Bono'] = { en: 'Bond', es: 'Bono' }
  return m
})()

/**
 * A human label for an instrument's `kind`. When region + class are supplied the
 * subclass registry resolves it precisely (so a fixed-income 'ETF' reads "Bond
 * ETF", not the equity one); otherwise it falls back to the flat label table.
 */
export const kindLabel = (
  kind: string | undefined,
  lang: Lang,
  region?: Region,
  category?: Category,
): string => {
  if (!kind) return ''
  if (region && category) {
    const sub = subclassFor(region, category, kind)
    if (sub) return lang === 'es' ? sub.es : sub.en
  }
  const m = KIND_LABELS[kind]
  return m ? m[lang] : kind
}

// ── Local-company logos ──────────────────────────────────────────────────────
// Parqet only covers US tickers, so Paraguayan issuers' logos are UPLOADED by
// the admin and served from the per-company store at /api/logos/:key, keyed by
// the issuer name normalized (accents + punctuation stripped, lowercased) so
// "IBI SAECA", "IBI S.A.E.C.A" and "Import Center**" all map to one logo.
/** Normalized issuer/company slug used as the logo key. */
export const logoKey = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '')
/**
 * Logo URL for a local company/issuer — points at the per-company upload store.
 * When nothing's been uploaded it 404s and CompanyLogo falls back to a monogram.
 */
export const localLogoUrl = (name?: string): string | undefined => {
  const key = name ? logoKey(name) : ''
  return key ? `/api/logos/${key}` : undefined
}

// ── Autofill coverage ────────────────────────────────────────────────────────
// Which detail fields the "Fetch data" autofill can populate, per asset class.
// This MUST track what the server actually returns (see server/src/marketData.ts):
// Yahoo for equities/ETFs, CoinGecko + Deribit for crypto. Classes absent here
// have no market-data source at all — the Fetch button is hidden for them.
export const FETCHABLE_FIELDS: Partial<Record<AssetClass, string[]>> = {
  // Keep in sync with the fields fetchYahoo returns (server/src/marketData.ts).
  Equities: [
    'description', 'kind', 'sectorIndex', 'exchange', 'lastPrice', 'change1Y',
    'range52w', 'avgVolume', 'marketCapAum', 'dividendYield', 'peRatio', 'peForward', 'beta',
    'impliedVol3m', 'priceTarget', 'potentialReturn', 'recBuyPct', 'recHoldPct', 'recSellPct',
    'analystCount', 'asOf',
  ],
  Crypto: ['lastPrice', 'change1Y', 'marketCap', 'avgVolume', 'impliedVol3m', 'asOf'],
  // Bond ETFs (a ticker) fetch from Yahoo just like equities — minus the
  // earnings/analyst metrics that don't apply. Individual bonds carry no ticker,
  // so nothing fetches and the firm's mirror fields stand.
  'Fixed income': [
    'description', 'kind', 'sectorIndex', 'exchange', 'lastPrice', 'change1Y',
    'range52w', 'avgVolume', 'marketCapAum', 'dividendYield', 'asOf',
  ],
}

// Autofill is a global-only capability — there's no market-data feed for the
// local Cadiem instruments, so both helpers return "none" for local. When a
// subclass is known, fetchability is per-subclass (a Bond ETF fetches, a
// fixed-rate bond doesn't); without a kind they fall back to the class default.
/** The set of detail keys Fetch can fill for this instrument (empty if none). */
export const fetchableFields = (
  category: Category,
  region: Region = 'global',
  kind?: string,
): Set<string> => {
  if (region !== 'global') return new Set()
  const sub = subclassFor('global', category, kind)
  if (sub) return new Set(sub.fetch ?? [])
  return new Set(FETCHABLE_FIELDS[category as AssetClass] ?? [])
}
/** True if this instrument has a market-data autofill source. */
export const supportsFetch = (category: Category, region: Region = 'global', kind?: string): boolean =>
  fetchableFields(category, region, kind).size > 0

// ── Quick facts ──────────────────────────────────────────────────────────────
// A compact, category-appropriate summary line for a LOCAL instrument, used in
// both the admin catalog rows and the advisor's recommended-instruments list.

export type QuickFactLabels = { common: string; preferred: string; yrs: string }

/** Compact currency glyph from a "PYG (₲)" / "USD ($)" detail string. */
export const currencyGlyph = (c = ''): string =>
  c.includes('$') || /usd/i.test(c) ? '$' : c.includes('₲') || /pyg|gs/i.test(c) ? '₲' : c

/**
 * Category-appropriate quick facts for a LOCAL instrument ('' for global):
 *   bonds/CDs → yield · rating · currency · years-to-maturity
 *   equities  → yield · common/preferred · currency
 *   funds     → yield · currency
 */
export function localQuickFacts(inst: ManagedInstrument, labels: QuickFactLabels): string {
  if ((inst.region ?? 'global') !== 'local') return ''
  const d = inst.details
  const isDebt = inst.assetClass === 'Fixed income' || inst.assetClass === 'CDs'
  const parts: string[] = []
  if (d.estYield) parts.push(d.estYield)
  if (isDebt) {
    if (d.rating) parts.push(d.rating)
  } else if (inst.assetClass === 'Equities') {
    // Ordinary vs preferred is carried by the kind now (Acción Ordinaria /
    // Acción Preferida); fall back to the legacy shareType text.
    const t = `${inst.kind ?? ''} ${d.shareType ?? ''}`.toLowerCase()
    parts.push(/preferid/.test(t) ? labels.preferred : labels.common)
  }
  const cur = currencyGlyph(d.currency)
  if (cur) parts.push(cur)
  if (isDebt && d.residualYears) parts.push(`${d.residualYears} ${labels.yrs}`)
  return parts.join(' · ')
}

// ── Seeding ──────────────────────────────────────────────────────────────────

// Stable id for a bundled instrument (ticker alone isn't unique — OTC repeats).
function slugId(inst: Instrument): string {
  return (inst.ticker + '-' + inst.name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function seedCatalog(): ManagedInstrument[] {
  return INSTRUMENTS.map((inst) => {
    const id = slugId(inst)
    return {
      ...inst,
      id,
      visible: true,
      emphasized: false,
      details: SEED_DETAILS[id] ?? {},
    }
  })
}

// ── React context (backend-API backed) ──────────────────────────────────────

type CatalogContextValue = {
  instruments: ManagedInstrument[]
  loading: boolean
  /** Insert or replace by id, then persist. */
  upsert: (item: ManagedInstrument) => void
  remove: (id: string) => void
  /** Delete many by id in one go (used by the admin's bulk "delete filtered"). */
  removeMany: (ids: string[]) => void
  /** Insert or replace many by id in one go (used to load the Cadiem menu). */
  addMany: (items: ManagedInstrument[]) => void
}

const CatalogContext = createContext<CatalogContextValue>({
  instruments: [],
  loading: true,
  upsert: () => {},
  remove: () => {},
  removeMany: () => {},
  addMany: () => {},
})

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [instruments, setInstruments] = useState<ManagedInstrument[]>([])
  const [loading, setLoading] = useState(true)

  // Load whatever's in the catalog. No auto-seeding: the catalog starts empty
  // and the admin builds it up (a fresh start, by request). On a backend error
  // we also show nothing rather than resurrecting the bundled sample set.
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const items = await api.get<ManagedInstrument[]>('/catalog')
        if (alive) setInstruments(items ?? [])
      } catch {
        if (alive) setInstruments([])
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const value = useMemo<CatalogContextValue>(
    () => ({
      instruments,
      loading,
      upsert: (item) => {
        const stamped = { ...item, updatedAt: new Date().toISOString() }
        setInstruments((prev) => {
          const idx = prev.findIndex((i) => i.id === item.id)
          return idx === -1 ? [...prev, stamped] : prev.map((i) => (i.id === item.id ? stamped : i))
        })
        void api.put(`/catalog/${item.id}`, stamped).catch((e) => console.warn('catalog save:', e))
      },
      remove: (id) => {
        setInstruments((prev) => prev.filter((i) => i.id !== id))
        void api.del(`/catalog/${id}`).catch((e) => console.warn('catalog delete:', e))
      },
      removeMany: (ids) => {
        const drop = new Set(ids)
        setInstruments((prev) => prev.filter((i) => !drop.has(i.id)))
        void Promise.all(
          ids.map((id) => api.del(`/catalog/${id}`).catch((e) => console.warn('catalog delete:', id, e))),
        )
      },
      addMany: (items) => {
        const stamped = items.map((it) => ({ ...it, updatedAt: new Date().toISOString() }))
        const ids = new Set(stamped.map((it) => it.id))
        setInstruments((prev) => [...prev.filter((i) => !ids.has(i.id)), ...stamped])
        void Promise.all(
          stamped.map((it) => api.put(`/catalog/${it.id}`, it).catch((e) => console.warn('catalog add:', it.id, e))),
        )
      },
    }),
    [instruments, loading],
  )

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>
}

export function useCatalog(): CatalogContextValue {
  return useContext(CatalogContext)
}
