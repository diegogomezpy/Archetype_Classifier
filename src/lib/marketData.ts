// ---------------------------------------------------------------------------
// Market-data autofill seam
// ---------------------------------------------------------------------------
// The admin form can request an automatic fill of an instrument's detail fields
// from a market-data source (price, volume, dividend yield, coupon/rating, ATM
// 3M implied vol, …). That fetch is intentionally behind a provider interface:
//
//   * A static browser app CANNOT do this reliably. Yahoo Finance's endpoints
//     are CORS-blocked from the browser, and ATM implied vol needs an OPTIONS
//     data provider (with a key) that has no free browser-callable endpoint.
//   * So live autofill belongs in the Phase-2 backend: a small server-side
//     function proxies the market-data / options API and returns detail fields.
//     Wiring it up is then a one-liner here — setMarketDataProvider(realProvider).
//
// Result fields are keyed by the same FieldSpec.key values as the detail sheets,
// so a provider result merges straight into ManagedInstrument.details.

import type { AssetClass } from './instruments'

export type MarketDataQuery = {
  ticker?: string
  isin?: string
  assetClass: AssetClass
}

export type MarketDataResult =
  | { ok: true; fields: Record<string, string> }
  // `reason` is a stable code the UI maps to a localized message.
  | { ok: false; reason: 'unavailable' | 'not_found' | 'error' }

export interface MarketDataProvider {
  fetch(query: MarketDataQuery): Promise<MarketDataResult>
}

// Default: no provider in the static build. Reports "unavailable" so the UI can
// explain that live autofill arrives with the backend — rather than silently
// doing nothing or inventing fake numbers.
class UnconfiguredProvider implements MarketDataProvider {
  async fetch(): Promise<MarketDataResult> {
    return { ok: false, reason: 'unavailable' }
  }
}

let provider: MarketDataProvider = new UnconfiguredProvider()

export function setMarketDataProvider(p: MarketDataProvider): void {
  provider = p
}

export function isAutofillConfigured(): boolean {
  return !(provider instanceof UnconfiguredProvider)
}

export function fetchInstrumentData(query: MarketDataQuery): Promise<MarketDataResult> {
  if (!query.ticker && !query.isin) return Promise.resolve({ ok: false, reason: 'not_found' })
  return provider.fetch(query)
}
