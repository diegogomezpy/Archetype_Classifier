import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { INSTRUMENTS, type AssetClass, type Instrument } from './instruments'
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
const AS_OF: FieldSpec = { key: 'asOf', en: 'Data as of', es: 'Datos al' }

export const ASSET_FIELD_SPECS: Record<AssetClass, FieldSpec[]> = {
  Equities: [
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
    { key: 'expenseRatio', en: 'Expense ratio (%, ETFs)', es: 'Comisión de gestión (%, ETFs)' },
    { key: 'beta', en: 'Beta vs. market', es: 'Beta vs. mercado' },
    { key: 'impliedVol3m', en: 'ATM 3M implied vol (%)', es: 'Vol. implícita ATM 3M (%)' },
    AS_OF,
  ],
  'Fixed income': [
    DESCRIPTION,
    { key: 'issuer', en: 'Issuer', es: 'Emisor' },
    { key: 'couponRate', en: 'Coupon rate (%)', es: 'Tasa cupón (%)' },
    { key: 'couponFrequency', en: 'Coupon frequency', es: 'Frecuencia del cupón' },
    { key: 'maturity', en: 'Maturity / avg. maturity', es: 'Vencimiento / vencimiento prom.' },
    { key: 'duration', en: 'Duration (years)', es: 'Duración (años)' },
    { key: 'ytm', en: 'Yield to maturity (%)', es: 'Rendimiento al vencimiento (%)' },
    { key: 'creditRating', en: 'Credit rating', es: 'Calificación crediticia' },
    { key: 'minInvestment', en: 'Minimum investment', es: 'Inversión mínima' },
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
  reset: () => void
}

const CatalogContext = createContext<CatalogContextValue>({
  instruments: [],
  loading: true,
  upsert: () => {},
  remove: () => {},
  reset: () => {},
})

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [instruments, setInstruments] = useState<ManagedInstrument[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        let items = await api.get<ManagedInstrument[]>('/catalog')
        // First run: seed the catalog from the bundled defaults.
        if (!items || items.length === 0) {
          const res = await api.post<{ items: ManagedInstrument[] }>('/catalog/seed', seedCatalog())
          items = res.items
        }
        if (alive) setInstruments(items)
      } catch {
        // Backend unreachable — fall back to the bundled defaults (read-only).
        if (alive) setInstruments(seedCatalog())
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
      reset: () => {
        const seed = seedCatalog()
        setInstruments(seed)
        void api.post('/catalog/reset', seed).catch((e) => console.warn('catalog reset:', e))
      },
    }),
    [instruments, loading],
  )

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>
}

export function useCatalog(): CatalogContextValue {
  return useContext(CatalogContext)
}
