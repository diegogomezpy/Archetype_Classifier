// ---------------------------------------------------------------------------
// Market-data autofill (MVP: straight from the browser)
// ---------------------------------------------------------------------------
// Fills an instrument's detail sheet from live market data, keyed off ticker
// (or ISIN):
//
//   • Crypto  → CoinGecko (keyless, CORS-open). Works out of the box.
//   • Equities/ETFs → Financial Modeling Prep. Free API key, entered once in
//     the admin "Market data source" panel (stored in this browser).
//
// No source exists for bond/structured reference data or equity implied vol —
// those detail fields stay manual. When the GCP backend lands, these calls move
// server-side (hidden key, plus Deribit crypto implied vol).

import type { AssetClass } from './instruments'

export type MarketDataQuery = {
  ticker?: string
  isin?: string
  assetClass: AssetClass
}

export type MarketDataResult =
  | { ok: true; fields: Record<string, string> }
  // stable codes the UI maps to a localized message
  | { ok: false; reason: 'no_key' | 'unsupported' | 'not_found' | 'network' }

// ── Config (equity API key), persisted in this browser ──────────────────────

export type EquityProviderId = 'none' | 'fmp'
export type MarketDataConfig = { equityProvider: EquityProviderId; apiKey: string }

const CONFIG_KEY = 'ip_marketdata_config_v1'

export function getMarketDataConfig(): MarketDataConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (raw) {
      const p = JSON.parse(raw) as Partial<MarketDataConfig>
      return { equityProvider: p.equityProvider === 'fmp' ? 'fmp' : 'none', apiKey: p.apiKey ?? '' }
    }
  } catch {
    /* ignore */
  }
  return { equityProvider: 'none', apiKey: '' }
}

export function setMarketDataConfig(config: MarketDataConfig): void {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config))
  } catch {
    /* ignore */
  }
}

// ── Formatting helpers ───────────────────────────────────────────────────────

const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  return Number.isFinite(n) ? n : null
}
const price = (v: unknown) => {
  const n = num(v)
  return n === null ? '' : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
const compact = (v: unknown) => {
  const n = num(v)
  return n === null ? '' : new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
}
const pctSigned = (v: unknown) => {
  const n = num(v)
  return n === null ? '' : (n >= 0 ? '+' : '') + n.toFixed(1) + '%'
}
const pctPlain = (v: unknown) => {
  const n = num(v)
  return n === null ? '' : n.toFixed(2) + '%'
}
const fixed = (v: unknown, d = 2) => {
  const n = num(v)
  return n === null ? '' : n.toFixed(d)
}
const asOf = () => new Date().toISOString().slice(0, 10)
const truncate = (s: string, max = 240) => (s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s)

// Keep only fields that resolved to a non-empty value, so a fetch never blanks
// out data the admin already entered.
function clean(fields: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(fields)) if (v && v.trim() !== '') out[k] = v
  return out
}

// ── Crypto: CoinGecko (keyless) ──────────────────────────────────────────────

const COIN_IDS: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  BNB: 'binancecoin',
  XRP: 'ripple',
  ADA: 'cardano',
  DOGE: 'dogecoin',
  AVAX: 'avalanche-2',
  LTC: 'litecoin',
  DOT: 'polkadot',
  LINK: 'chainlink',
  MATIC: 'matic-network',
}

async function fetchCoinGecko(coinId: string): Promise<MarketDataResult> {
  const url =
    `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${coinId}` +
    `&price_change_percentage=1y`
  const res = await fetch(url)
  if (!res.ok) return { ok: false, reason: 'network' }
  const data = (await res.json()) as Array<Record<string, unknown>>
  const d = data?.[0]
  if (!d) return { ok: false, reason: 'not_found' }
  return {
    ok: true,
    fields: clean({
      lastPrice: price(d.current_price),
      change1Y: pctSigned(d.price_change_percentage_1y_in_currency),
      marketCap: '$' + compact(d.market_cap),
      avgVolume: '$' + compact(d.total_volume),
      asOf: asOf(),
    }),
  }
}

// ── Equities/ETFs: Financial Modeling Prep (keyed) ───────────────────────────

const FMP = 'https://financialmodelingprep.com/api'

async function fmpJson<T>(path: string): Promise<T | null> {
  const res = await fetch(`${FMP}${path}`)
  if (!res.ok) return null
  return (await res.json()) as T
}

async function fetchFmpBySymbol(symbol: string, key: string): Promise<MarketDataResult> {
  const enc = encodeURIComponent(symbol)
  const [quoteArr, profileArr, changeArr] = await Promise.all([
    fmpJson<Array<Record<string, unknown>>>(`/v3/quote/${enc}?apikey=${key}`),
    fmpJson<Array<Record<string, unknown>>>(`/v3/profile/${enc}?apikey=${key}`),
    fmpJson<Array<Record<string, unknown>>>(`/v3/stock-price-change/${enc}?apikey=${key}`),
  ])
  const q = quoteArr?.[0]
  const p = profileArr?.[0]
  const c = changeArr?.[0]
  if (!q && !p) return { ok: false, reason: 'not_found' }

  const lastPx = num(q?.price)
  const lastDiv = num(p?.lastDiv)
  const dividendYield = lastDiv !== null && lastPx ? pctPlain((lastDiv / lastPx) * 100) : ''

  return {
    ok: true,
    fields: clean({
      description: p?.description ? truncate(String(p.description)) : '',
      kind: p?.isEtf ? 'ETF' : p ? 'Single stock' : '',
      sectorIndex: String(p?.sector || p?.industry || ''),
      exchange: String(q?.exchange || p?.exchangeShortName || ''),
      lastPrice: price(q?.price),
      change1Y: c ? pctSigned(c['1Y']) : '',
      range52w:
        q?.yearLow && q?.yearHigh ? `${price(q.yearLow)} – ${price(q.yearHigh)}` : '',
      avgVolume: q?.avgVolume ? compact(q.avgVolume) + ' shares' : '',
      marketCapAum: q?.marketCap ? '$' + compact(q.marketCap) : '',
      dividendYield,
      peRatio: fixed(q?.pe, 1),
      beta: fixed(p?.beta, 2),
      asOf: asOf(),
    }),
  }
}

async function fetchFmpByIsin(isin: string, key: string): Promise<MarketDataResult> {
  const found = await fmpJson<Array<{ symbol?: string }>>(
    `/v4/search/isin?isin=${encodeURIComponent(isin)}&apikey=${key}`,
  )
  const symbol = found?.[0]?.symbol
  if (!symbol) return { ok: false, reason: 'not_found' }
  return fetchFmpBySymbol(symbol, key)
}

// ── Router ───────────────────────────────────────────────────────────────────

const NON_TICKERS = new Set(['OTC', 'LISTED', ''])

export async function fetchInstrumentData(query: MarketDataQuery): Promise<MarketDataResult> {
  const ticker = (query.ticker ?? '').trim()
  const isin = (query.isin ?? '').trim()
  const upper = ticker.toUpperCase()
  if (!ticker && !isin) return { ok: false, reason: 'not_found' }

  try {
    // Crypto coins → CoinGecko (no key needed).
    if (COIN_IDS[upper]) return await fetchCoinGecko(COIN_IDS[upper])

    // Everything else goes through the keyed equity provider.
    const cfg = getMarketDataConfig()
    if (cfg.equityProvider === 'none' || !cfg.apiKey.trim()) return { ok: false, reason: 'no_key' }

    if (!NON_TICKERS.has(upper)) return await fetchFmpBySymbol(ticker, cfg.apiKey.trim())
    if (isin) return await fetchFmpByIsin(isin, cfg.apiKey.trim())
    return { ok: false, reason: 'unsupported' }
  } catch {
    return { ok: false, reason: 'network' }
  }
}
