import yahooFinance from 'yahoo-finance2'

// Server-side market-data autofill. Runs on Cloud Run — no CORS limits, no keys
// in the browser.
//
//   • Equities / ETFs → Yahoo Finance (yahoo-finance2): description, price,
//     1-year change, 52-week range, volume, market cap, dividend yield, P/E,
//     beta, and ATM ~3-month implied vol from the option chain.
//   • Crypto → CoinGecko (price / mcap / volume) + Deribit DVOL (implied vol).
//   • Bonds / structured products → no source; those fields stay manual.

// ── Yahoo access from a datacenter IP (Cloud Run) ────────────────────────────
// Yahoo's default data host (query2) returns HTTP 429 for GCP/AWS IP ranges,
// while query1 (which the crumb handshake already uses successfully) does not.
// Route data calls to query1 and send a real browser User-Agent — together this
// mirrors the working crumb request and gets past the block.
yahooFinance.setGlobalConfig({ YF_QUERY_HOST: 'query1.finance.yahoo.com' })
const YF_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
// Shared per-call options: skip schema validation (Yahoo shapes drift) and
// override the bot User-Agent with a browser one.
const YF_OPTS = { validateResult: false, fetchOptions: { headers: { 'User-Agent': YF_UA } } } as const

export type MarketDataQuery = { ticker?: string; isin?: string; assetClass?: string }
export type MarketDataResult =
  | { ok: true; fields: Record<string, string> }
  | { ok: false; reason: 'unsupported' | 'not_found' | 'network' }

// ── formatting ───────────────────────────────────────────────────────────────
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
const clean = (f: Record<string, string>): Record<string, string> => {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(f)) if (v && v.trim() !== '') out[k] = v
  return out
}

// ── Yahoo: equities / ETFs ───────────────────────────────────────────────────

// Yahoo's option chain is noisy: contracts with no live quote come back with a
// near-zero impliedVolatility, and thin strikes throw out absurd ones (we've
// seen a 125% call against a 45% put on the SAME strike and expiry). A single
// ATM contract is therefore not trustworthy. Guard rails:
//   • only contracts that actually trade (open interest or volume),
//   • only implausible-free IVs (1%–300%),
//   • median of the few strikes nearest the money, so one bad print can't win.
const IV_MIN = 0.01
const IV_MAX = 3
const IV_STRIKES = 3 // per side, nearest the money

type Contract = {
  strike: number
  impliedVolatility?: number
  openInterest?: number
  volume?: number
}

function usableIvs(arr: Contract[], px: number): number[] {
  return arr
    .filter((c) => (num(c.openInterest) ?? 0) > 0 || (num(c.volume) ?? 0) > 0)
    .filter((c) => {
      const iv = num(c.impliedVolatility)
      return iv !== null && iv >= IV_MIN && iv <= IV_MAX
    })
    .sort((a, b) => Math.abs(a.strike - px) - Math.abs(b.strike - px))
    .slice(0, IV_STRIKES)
    .map((c) => c.impliedVolatility as number)
}

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

// ATM implied vol at the expiry nearest ~90 days out. Best-effort — returns ''
// rather than a number we don't believe.
async function atmImpliedVol(symbol: string, spot: number | null): Promise<string> {
  try {
    const head = await yahooFinance.options(symbol, {}, YF_OPTS)
    const exps: Date[] = head.expirationDates ?? []
    if (!exps.length) return ''
    const target = Date.now() + 90 * 24 * 60 * 60 * 1000
    const chosen = exps.reduce((best, d) =>
      Math.abs(d.getTime() - target) < Math.abs(best.getTime() - target) ? d : best,
    )
    const chain = await yahooFinance.options(symbol, { date: chosen }, YF_OPTS)
    const leg = chain.options?.[0]
    if (!leg) return ''
    const px = spot ?? num(chain.quote?.regularMarketPrice) ?? 0
    if (!px) return ''
    const ivs = [
      ...usableIvs((leg.calls ?? []) as Contract[], px),
      ...usableIvs((leg.puts ?? []) as Contract[], px),
    ]
    if (!ivs.length) return ''
    return (100 * median(ivs)).toFixed(1) + '%'
  } catch {
    return ''
  }
}

async function fetchYahoo(symbol: string): Promise<MarketDataResult> {
  let qs
  try {
    qs = await yahooFinance.quoteSummary(
      symbol,
      {
        modules: [
          'price',
          'summaryDetail',
          'assetProfile',
          'defaultKeyStatistics',
          // The research firm only sends us a ticker + rationale now, so the
          // street consensus (target price, buy-recs) has to come from here.
          'financialData',
          'recommendationTrend',
        ],
      },
      YF_OPTS,
    )
  } catch (e) {
    console.error('yahoo quoteSummary failed for', symbol, '-', (e as Error)?.message ?? e)
    return { ok: false, reason: 'not_found' }
  }
  const p = qs.price as Record<string, unknown> | undefined
  const sd = qs.summaryDetail as Record<string, unknown> | undefined
  const ap = qs.assetProfile as Record<string, unknown> | undefined
  const ks = qs.defaultKeyStatistics as Record<string, unknown> | undefined
  const fd = qs.financialData as Record<string, unknown> | undefined
  const trend = (qs.recommendationTrend as { trend?: Array<Record<string, unknown>> } | undefined)
    ?.trend?.[0]
  if (!p && !sd) return { ok: false, reason: 'not_found' }

  const spot = num(p?.regularMarketPrice)
  // Consensus: mean analyst target, and the share of analysts saying buy.
  const target = num(fd?.targetMeanPrice)
  const buys = (num(trend?.strongBuy) ?? 0) + (num(trend?.buy) ?? 0)
  const holds = num(trend?.hold) ?? 0
  const sells = (num(trend?.sell) ?? 0) + (num(trend?.strongSell) ?? 0)
  const totalRecs = buys + holds + sells
  const isEtf = String(p?.quoteType ?? '').toUpperCase() === 'ETF'
  const chg1y = num(ks?.['52WeekChange'])
  const divY = num(sd?.dividendYield) ?? num(sd?.trailingAnnualDividendYield)

  return {
    ok: true,
    fields: clean({
      // `name` isn't a detail field — importers lift it onto the instrument and
      // drop it from details (see components/ImportRanking.tsx).
      name: String(p?.longName || p?.shortName || ''),
      description: String(ap?.longBusinessSummary ?? '').trim(),
      kind: isEtf ? 'ETF' : 'Single stock',
      sectorIndex: String(ap?.sector || ap?.industry || ''),
      exchange: String(p?.exchangeName || p?.fullExchangeName || ''),
      lastPrice: price(spot),
      change1Y: chg1y === null ? '' : pctSigned(chg1y * 100),
      range52w:
        sd?.fiftyTwoWeekLow && sd?.fiftyTwoWeekHigh
          ? `${price(sd.fiftyTwoWeekLow)} – ${price(sd.fiftyTwoWeekHigh)}`
          : '',
      avgVolume:
        sd?.averageVolume || sd?.averageDailyVolume10Day
          ? compact(sd.averageVolume ?? sd.averageDailyVolume10Day) + ' shares'
          : '',
      marketCapAum: p?.marketCap ? '$' + compact(p.marketCap) : '',
      dividendYield: divY === null ? '' : pctPlain(divY * 100),
      peRatio: fixed(sd?.trailingPE, 1),
      peForward: fixed(sd?.forwardPE, 1),
      beta: fixed(sd?.beta ?? ks?.beta, 2),
      priceTarget: price(target),
      // Recomputed against the live price every time this runs, so upside never
      // goes stale between research updates.
      potentialReturn:
        target !== null && spot !== null && spot > 0 ? pctSigned((target / spot - 1) * 100) : '',
      recBuyPct: totalRecs > 0 ? pctPlain((buys / totalRecs) * 100) : '',
      recHoldPct: totalRecs > 0 ? pctPlain((holds / totalRecs) * 100) : '',
      recSellPct: totalRecs > 0 ? pctPlain((sells / totalRecs) * 100) : '',
      analystCount: totalRecs > 0 ? String(totalRecs) : '',
      impliedVol3m: await atmImpliedVol(symbol, spot),
      asOf: asOf(),
    }),
  }
}

async function yahooSymbolForIsin(isin: string): Promise<string | null> {
  try {
    const res = await yahooFinance.search(isin, {}, YF_OPTS)
    const quotes = (res.quotes ?? []) as Array<{ symbol?: string }>
    return quotes.find((q) => !!q.symbol)?.symbol ?? null
  } catch {
    return null
  }
}

// ── Crypto: CoinGecko + Deribit ──────────────────────────────────────────────

const COIN_IDS: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', BNB: 'binancecoin', XRP: 'ripple',
  ADA: 'cardano', DOGE: 'dogecoin', AVAX: 'avalanche-2', LTC: 'litecoin', DOT: 'polkadot',
  LINK: 'chainlink', MATIC: 'matic-network',
}
const DVOL_CCY: Record<string, string> = { BTC: 'BTC', ETH: 'ETH' }

async function fetchDvol(ccy: string): Promise<string> {
  try {
    const end = Date.now()
    const start = end - 3 * 24 * 60 * 60 * 1000
    const url =
      `https://www.deribit.com/api/v2/public/get_volatility_index_data` +
      `?currency=${ccy}&start_timestamp=${start}&end_timestamp=${end}&resolution=3600`
    const res = await fetch(url)
    if (!res.ok) return ''
    const body = (await res.json()) as { result?: { data?: number[][] } }
    const rows = body.result?.data
    const last = rows && rows.length ? rows[rows.length - 1] : null
    return last ? fixed(last[4], 1) + '%' : ''
  } catch {
    return ''
  }
}

async function fetchCrypto(symbol: string): Promise<MarketDataResult> {
  const url =
    `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${COIN_IDS[symbol]}` +
    `&price_change_percentage=1y`
  const res = await fetch(url)
  if (!res.ok) return { ok: false, reason: 'network' }
  const data = (await res.json()) as Array<Record<string, unknown>>
  const d = data?.[0]
  if (!d) return { ok: false, reason: 'not_found' }
  const dvol = DVOL_CCY[symbol] ? await fetchDvol(DVOL_CCY[symbol]) : ''
  return {
    ok: true,
    fields: clean({
      lastPrice: price(d.current_price),
      change1Y: pctSigned(d.price_change_percentage_1y_in_currency),
      marketCap: '$' + compact(d.market_cap),
      avgVolume: '$' + compact(d.total_volume),
      impliedVol3m: dvol,
      asOf: asOf(),
    }),
  }
}

// ── Router ───────────────────────────────────────────────────────────────────

const NON_TICKERS = new Set(['OTC', 'LISTED', ''])

export async function fetchInstrumentData(query: MarketDataQuery): Promise<MarketDataResult> {
  const ticker = (query.ticker ?? '').trim()
  const isin = (query.isin ?? '').trim()
  const upper = ticker.toUpperCase()
  if (!ticker && !isin) return { ok: false, reason: 'not_found' }
  try {
    if (COIN_IDS[upper]) return await fetchCrypto(upper)
    if (!NON_TICKERS.has(upper)) return await fetchYahoo(ticker)
    if (isin) {
      const sym = await yahooSymbolForIsin(isin)
      return sym ? await fetchYahoo(sym) : { ok: false, reason: 'not_found' }
    }
    return { ok: false, reason: 'unsupported' }
  } catch {
    return { ok: false, reason: 'network' }
  }
}
