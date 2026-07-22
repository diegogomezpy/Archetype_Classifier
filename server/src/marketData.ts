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

// Yahoo's option chain is unreliable in two ways:
//   1. thin strikes throw out absurd single prints (we've seen a 125% call
//      against a 45% put on the SAME strike and expiry), and
//   2. for some names — and sometimes across the WHOLE feed — Yahoo serves
//      broken near-zero IVs even with real open interest (observed: NVDA/GM/
//      AAPL/MU ATM calls all printing 0–3% in a quantized 0.4→0.8→1.6→3.1%
//      doubling artifact when the true IV is ~40%+).
// So we can't trust a single contract, and we can't just floor per-contract
// (that skips the broken near-zero ATM prints and grabs a further junk print).
// Instead: take the strikes NEAREST the money (both sides), median them, and
// judge the MEDIAN — if it lands implausibly low, the feed is broken and we
// publish nothing rather than a number we don't believe.
const IV_MAX = 3 // 300% — a single print above this is garbage, drop it
const IV_STRIKES = 3 // nearest strikes per side
const IV_MONEYNESS = 0.15 // a strike is "near the money" within ±15% of spot
// No real equity/ETF has a 3-month ATM implied vol below ~10%; a near-money
// median under this means the feed is broken → blank it.
const IV_MIN_PLAUSIBLE = 0.1

type Contract = {
  strike: number
  impliedVolatility?: number
  openInterest?: number
  volume?: number
}

// IVs of the liquid strikes nearest the money. Raw (only 0 and >300% dropped) so
// a broken near-zero ATM print still drags the median down and gets caught by the
// plausibility check — rather than being silently skipped for a further junk print.
function nearMoneyIvs(arr: Contract[], px: number): number[] {
  if (!(px > 0)) return []
  return arr
    .filter((c) => (num(c.openInterest) ?? 0) > 0 || (num(c.volume) ?? 0) > 0)
    .filter((c) => Math.abs(c.strike - px) <= IV_MONEYNESS * px)
    .filter((c) => {
      const iv = num(c.impliedVolatility)
      return iv !== null && iv > 0 && iv <= IV_MAX
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
      ...nearMoneyIvs((leg.calls ?? []) as Contract[], px),
      ...nearMoneyIvs((leg.puts ?? []) as Contract[], px),
    ]
    if (!ivs.length) return ''
    const m = median(ivs)
    // A whole chain of near-zero ATM IVs (Yahoo serves these even with real open
    // interest) medians out implausibly low — don't publish what we don't believe.
    if (m < IV_MIN_PLAUSIBLE) return ''
    return (100 * m).toFixed(1) + '%'
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
          // `price.longName` is missing for some ETFs, leaving only the 32-char
          // `shortName` ("iShares J.P. Morgan USD Emergin"). quoteType carries a
          // second copy of both, so we can pick whichever is complete.
          'quoteType',
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
  const qt = qs.quoteType as Record<string, unknown> | undefined
  const sd = qs.summaryDetail as Record<string, unknown> | undefined
  const ap = qs.assetProfile as Record<string, unknown> | undefined
  const ks = qs.defaultKeyStatistics as Record<string, unknown> | undefined
  const fd = qs.financialData as Record<string, unknown> | undefined
  const trend = (qs.recommendationTrend as { trend?: Array<Record<string, unknown>> } | undefined)
    ?.trend?.[0]
  if (!p && !sd) return { ok: false, reason: 'not_found' }

  // Yahoo caps `shortName` at 32 chars, and for several iShares bond ETFs it
  // omits `longName` from quoteSummary entirely — which is how a name like
  // "iShares J.P. Morgan USD Emergin" ends up stored. Prefer a longName; only
  // when NONE is on offer (the exact broken case) pay for the v7 quote endpoint,
  // which does carry the full name, before settling for the truncated short one.
  const longest = (vals: unknown[]) =>
    vals
      .map((v) => String(v ?? '').trim())
      .filter(Boolean)
      .sort((a, b) => b.length - a.length)[0] ?? ''
  let bestName = longest([qt?.longName, p?.longName])
  if (!bestName) {
    try {
      const q = (await yahooFinance.quote(symbol, {}, YF_OPTS)) as Record<string, unknown>
      bestName = longest([q?.longName, q?.displayName])
    } catch {
      /* fall through to the short name */
    }
  }
  if (!bestName) bestName = longest([qt?.shortName, p?.shortName])

  const spot = num(p?.regularMarketPrice)
  // Consensus: mean analyst target, and the share of analysts saying buy.
  const target = num(fd?.targetMeanPrice)
  const buys = (num(trend?.strongBuy) ?? 0) + (num(trend?.buy) ?? 0)
  const holds = num(trend?.hold) ?? 0
  const sells = (num(trend?.sell) ?? 0) + (num(trend?.strongSell) ?? 0)
  const totalRecs = buys + holds + sells
  const isEtf = String(p?.quoteType ?? '').toUpperCase() === 'ETF'

  // A fund populates almost none of the company modules above — no assetProfile
  // sector, no price.marketCap, often no 52WeekChange. Its equivalents (category,
  // total assets, trailing returns, expense ratio) live in the fund modules, so
  // pull those for ETFs only; equities never pay for the extra call.
  let fp: Record<string, unknown> | undefined
  let perf: Record<string, unknown> | undefined
  if (isEtf) {
    try {
      const f = await yahooFinance.quoteSummary(
        symbol,
        { modules: ['fundProfile', 'fundPerformance'] as never },
        YF_OPTS,
      )
      fp = f.fundProfile as Record<string, unknown> | undefined
      perf = f.fundPerformance as Record<string, unknown> | undefined
    } catch {
      /* fund fields just stay empty */
    }
  }
  const trailing = (perf?.trailingReturns as Record<string, unknown> | undefined) ?? undefined
  const fees = (fp?.feesExpensesInvestment as Record<string, unknown> | undefined) ?? undefined

  const chg1y = num(ks?.['52WeekChange']) ?? num(trailing?.oneYear)
  // `yield` is the fund-side name for the distribution yield.
  const divY =
    num(sd?.dividendYield) ?? num(sd?.trailingAnnualDividendYield) ?? num(sd?.yield)
  const aum = num(p?.marketCap) ?? num(sd?.totalAssets) ?? num(ks?.totalAssets)
  const expense = num(fees?.annualReportExpenseRatio)

  return {
    ok: true,
    fields: clean({
      // `name` isn't a detail field — importers lift it onto the instrument and
      // drop it from details (see components/ImportRanking.tsx).
      // Take the most complete name on offer: any single source can be the
      // 32-char truncated `shortName`, so prefer the longest candidate.
      name: bestName,
      description: String(ap?.longBusinessSummary ?? '').trim(),
      kind: isEtf ? 'ETF' : 'Acción Ordinaria',
      // A fund tracks a category/index rather than sitting in a GICS sector.
      sectorIndex: String(ap?.sector || ap?.industry || fp?.categoryName || ''),
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
      // Companies report a market cap; funds report total assets (AUM).
      marketCapAum: aum === null ? '' : '$' + compact(aum),
      dividendYield: divY === null ? '' : pctPlain(divY * 100),
      expenseRatio: expense === null ? '' : pctPlain(expense * 100),
      // Earnings multiples are meaningless for a fund — Yahoo still returns a
      // nonsense forwardPE for some bond ETFs, so drop them rather than show it.
      peRatio: isEtf ? '' : fixed(sd?.trailingPE, 1),
      peForward: isEtf ? '' : fixed(sd?.forwardPE, 1),
      beta: fixed(sd?.beta ?? ks?.beta ?? ks?.beta3Year, 2),
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

// ── Bond issuers ─────────────────────────────────────────────────────────────
// An individual bond has no ticker of its own, so its report has nothing to hang
// a logo or a company blurb on. The issuer, though, is usually a listed company —
// resolve its name to that equity and the bond can borrow both. Sovereigns and
// private issuers simply don't resolve; the caller falls back to a monogram.

// Sovereign/agency issuers have no equity to find — skip them rather than let a
// fuzzy search land on some unrelated ticker.
const SOVEREIGN_ISSUER =
  /\brepublic|republica|treasury|\btsy\b|kingdom|united mexican states|sovereign|international bond/i

// Legal forms and holding-company noise — dropping these turns "ALIBABA GROUP
// HOLDING LTD" into "ALIBABA", which is what actually matches a listed equity.
const LEGAL_NOISE =
  /\b(inc|incorporated|corp|corporation|company|ltd|limited|llc|lp|plc|sa|sab|de|cv|bv|nv|gmbh|ag|ab|asa|oyj|spa|pte|pty|holdings?|group|the)\b\.?/gi
// Bonds are very often issued by a financing vehicle rather than the operating
// company ("VALE OVERSEAS LTD", "PETROBRAS GLOBAL FINANCE BV"). Strip those too
// on a second pass so the search lands on the parent that has a logo + profile.
const SPV_NOISE = /\b(overseas|global|finance|financial|financing|capital|funding|credit|services|intl|international)\b/gi

/**
 * Progressively broader search queries for an issuer, best first. We try the
 * cleaned legal name, then the operating-company core, then just its first two
 * words — the first one that resolves to a listed equity wins.
 */
function issuerQueries(raw: string): string[] {
  const base = (raw ?? '')
    .split('/')[0] // "BANCO DO BRASIL SA/CAYMAN" → "BANCO DO BRASIL SA"
    .replace(/\(.*?\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!base || SOVEREIGN_ISSUER.test(base)) return []
  const squash = (s: string) => s.replace(/[^A-Za-z0-9 &.-]/g, ' ').replace(/\s+/g, ' ').trim()
  const noLegal = squash(base.replace(LEGAL_NOISE, ' '))
  const core = squash(noLegal.replace(SPV_NOISE, ' '))
  const firstTwo = core.split(' ').slice(0, 2).join(' ')
  // De-duplicate while preserving order, and never search an empty string.
  return [...new Set([noLegal || base, core, firstTwo].filter((s) => s.length > 1))]
}

export type IssuerProfile = { ticker: string; name: string; description: string }

/** Attach the company's business summary to a resolved symbol. */
async function withDescription(symbol: string, name: string): Promise<IssuerProfile> {
  let description = ''
  try {
    const qs = await yahooFinance.quoteSummary(symbol, { modules: ['assetProfile'] }, YF_OPTS)
    const ap = qs.assetProfile as Record<string, unknown> | undefined
    description = String(ap?.longBusinessSummary ?? '').trim()
  } catch {
    /* the logo still works without a blurb */
  }
  return { ticker: symbol, name, description }
}

type SearchQuote = { symbol?: string; quoteType?: string; longname?: string; shortname?: string }

/** Resolve a bond issuer's name to its listed equity + business summary. */
export async function fetchIssuerProfile(rawName: string): Promise<IssuerProfile> {
  const empty: IssuerProfile = { ticker: '', name: '', description: '' }
  const label = (x: SearchQuote) => String(x.longname || x.shortname || '')
  let fallback: { symbol: string; name: string } | null = null

  for (const q of issuerQueries(rawName)) {
    let quotes: SearchQuote[] = []
    try {
      const res = await yahooFinance.search(q, {}, YF_OPTS)
      quotes = (res.quotes ?? []) as SearchQuote[]
    } catch {
      continue
    }
    const equities = quotes.filter(
      (x) => !!x.symbol && String(x.quoteType ?? '').toUpperCase() === 'EQUITY',
    )
    if (equities.length === 0) continue
    // A plain symbol (NFLX, BABA) is the primary listing; a suffixed one like
    // "AHLA.DE" is a foreign secondary line with no profile and no logo. Take the
    // first primary we find; otherwise remember a secondary and keep broadening.
    const primary = equities.find((x) => !x.symbol!.includes('.'))
    if (primary?.symbol) return withDescription(primary.symbol, label(primary))
    if (!fallback) fallback = { symbol: equities[0].symbol!, name: label(equities[0]) }
  }
  return fallback ? withDescription(fallback.symbol, fallback.name) : empty
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
