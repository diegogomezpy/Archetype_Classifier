// ---------------------------------------------------------------------------
// Market-data autofill (client → backend API)
// ---------------------------------------------------------------------------
// The browser posts an instrument's identity to the server, which does the
// fetching (keys and provider logic live server-side):
//
//   • Equities/ETFs → Yahoo Finance: price, description, 52-week range, market
//     cap, dividend yield, P/E, beta, and ATM ~3-month implied vol.
//   • Crypto        → CoinGecko (price / market cap / volume) + Deribit (DVOL
//     implied vol).
//
// Bond/structured reference data has no free source and stays manual.

import type { AssetClass } from './instruments'
import { api } from './api'

export type MarketDataQuery = {
  ticker?: string
  isin?: string
  assetClass: AssetClass
}

export type MarketDataResult =
  | { ok: true; fields: Record<string, string> }
  // stable codes the UI maps to a localized message
  | { ok: false; reason: 'unsupported' | 'not_found' | 'network' }

export async function fetchInstrumentData(query: MarketDataQuery): Promise<MarketDataResult> {
  const ticker = (query.ticker ?? '').trim()
  const isin = (query.isin ?? '').trim()
  if (!ticker && !isin) return { ok: false, reason: 'not_found' }
  try {
    return await api.post<MarketDataResult>('/market-data', { ...query, ticker, isin })
  } catch {
    return { ok: false, reason: 'network' }
  }
}
