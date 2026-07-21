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
    { key: 'kind', en: 'Type (single stock / ETF)', es: 'Tipo (acción individual / ETF)' },
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
    DESCRIPTION,
    // Mirrors the research firm's bond listing 1:1 (ISIN · EMISOR · SECTOR ·
    // PAÍS · BID · ASK · YTM BID · YTM ASK · CPN · DUR · VENC. · RTG · YTC ·
    // PRÓX. CALL) so their columns paste straight in. Nothing here is fetchable
    // — no free market-data source covers corporate bonds.
    { key: 'issuer', en: 'Issuer', es: 'Emisor' },
    { key: 'sector', en: 'Sector', es: 'Sector' },
    { key: 'country', en: 'Country', es: 'País' },
    { key: 'creditRating', en: 'Credit rating', es: 'Calificación' },
    { key: 'couponRate', en: 'Coupon (%)', es: 'Cupón (%)' },
    { key: 'couponFrequency', en: 'Coupon frequency', es: 'Frecuencia del cupón' },
    { key: 'maturity', en: 'Maturity', es: 'Vencimiento' },
    { key: 'duration', en: 'Duration (years)', es: 'Duración (años)' },
    { key: 'bid', en: 'Bid', es: 'Bid' },
    { key: 'ask', en: 'Ask', es: 'Ask' },
    { key: 'ytmBid', en: 'YTM bid (%)', es: 'YTM bid (%)' },
    { key: 'ytmAsk', en: 'YTM ask (%)', es: 'YTM ask (%)' },
    { key: 'ytc', en: 'Yield to call (%)', es: 'Rendimiento al call (%)' },
    { key: 'nextCall', en: 'Next call date', es: 'Próx. call' },
    { key: 'minInvestment', en: 'Minimum piece', es: 'Lámina mínima' },
    { key: 'currency', en: 'Currency', es: 'Moneda' },
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
    { key: 'lastPrice', en: 'Last price (USD)', es: 'Último precio (USD)' },
    { key: 'change1Y', en: '1-year change (%)', es: 'Variación 1 año (%)' },
    { key: 'marketCap', en: 'Market cap', es: 'Capitalización de mercado' },
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

/** The detail-field schema for an instrument, by region + category. */
export function fieldSpecsFor(region: Region, category: Category): FieldSpec[] {
  return region === 'local'
    ? LOCAL_FIELD_SPECS[category as LocalCategory] ?? []
    : ASSET_FIELD_SPECS[category as AssetClass] ?? []
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
}

// Autofill is a global-only capability — there's no market-data feed for the
// local Cadiem instruments, so both helpers take the region and return "none"
// for local regardless of the category name (local 'Equities' isn't fetchable).
/** True if this instrument's class has a market-data autofill source. */
export const supportsFetch = (category: Category, region: Region = 'global'): boolean =>
  region === 'global' && (FETCHABLE_FIELDS[category as AssetClass]?.length ?? 0) > 0
/** The set of detail keys Fetch can fill for this class (empty if none). */
export const fetchableFields = (category: Category, region: Region = 'global'): Set<string> =>
  new Set(region === 'global' ? FETCHABLE_FIELDS[category as AssetClass] ?? [] : [])

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
    const s = (d.shareType ?? '').toLowerCase()
    if (/común|comun/.test(s)) parts.push(labels.common)
    else if (s) parts.push(labels.preferred)
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
