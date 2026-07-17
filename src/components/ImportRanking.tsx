import { useRef, useState, type ChangeEvent } from 'react'
import { useCatalog, type ManagedInstrument } from '../lib/catalog'
import { parseCsv, downloadText } from '../lib/csv'
import { fetchInstrumentData } from '../lib/marketData'
import { deriveDefaults, deriveRiskVector } from '../lib/riskDerivation'
import { useT } from '../i18n/i18n'

// ---------------------------------------------------------------------------
// Equity ranking import (global equities)
// ---------------------------------------------------------------------------
// The research firm sends five columns — the ones only they have — in the exact
// shape of their own ranking:
//
//   Ticker, % Rec Compra, Ret Potencial, Precio Objetivo, Descripción
//
// Everything else (name, price, P/E, beta, market cap, sector…) is fetched from
// market data per ticker, so their file never carries a stale copy of it.
// `Ret Potencial` is deliberately RECOMPUTED from their target and the live
// price: in their own report that column doesn't reconcile with their printed
// price ÷ target (they're stamped at different times), and it goes stale the
// moment the market moves.

const HEADERS: Record<string, string> = {
  ticker: 'ticker',
  recbuypct: 'recBuyPct',
  recompra: 'recBuyPct',
  reccompra: 'recBuyPct',
  buyrecommendations: 'recBuyPct',
  retpotencial: 'potentialReturn',
  potentialreturn: 'potentialReturn',
  precioobjetivo: 'priceTarget',
  pricetarget: 'priceTarget',
  target: 'priceTarget',
  descripcion: 'description',
  description: 'description',
  thesis: 'description',
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '')
const numOr = (v?: string): number | null => {
  if (!v) return null
  const n = parseFloat(v.replace(/[^0-9.,-]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

type Row = { ticker: string; recBuyPct?: string; priceTarget?: string; description?: string }

export function parseRankingCsv(text: string): Row[] {
  const rows = parseCsv(text).filter((r) => r.some((c) => c.trim()))
  if (rows.length < 2) return []
  const head = rows[0].map(norm)
  const idx = (key: string) => head.findIndex((h) => HEADERS[h] === key)
  const iT = idx('ticker')
  if (iT < 0) return []
  const iR = idx('recBuyPct')
  const iP = idx('priceTarget')
  const iD = idx('description')
  const out: Row[] = []
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i]
    if ((cells[0] ?? '').trim().startsWith('#')) continue // marker/comment row
    const ticker = (cells[iT] ?? '').trim().toUpperCase()
    if (!ticker) continue
    out.push({
      ticker,
      recBuyPct: iR >= 0 ? cells[iR]?.trim() : undefined,
      priceTarget: iP >= 0 ? cells[iP]?.trim() : undefined,
      description: iD >= 0 ? cells[iD]?.trim() : undefined,
    })
  }
  return out
}

export default function ImportRanking() {
  const t = useT()
  const { addMany } = useCatalog()
  const [built, setBuilt] = useState<ManagedInstrument[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0, failed: 0 })
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const template = () =>
    downloadText(
      'equity-ranking-template.csv',
      'Ticker,% Rec Compra,Ret Potencial,Precio Objetivo,Descripción\n',
    )

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setDone(null)
    setBuilt(null)
    const rows = parseRankingCsv(await file.text())
    if (fileRef.current) fileRef.current.value = ''
    if (rows.length === 0) {
      setError(t.admin.rankingNoRows)
      return
    }

    setBusy(true)
    setProgress({ done: 0, total: rows.length, failed: 0 })
    const out: ManagedInstrument[] = []
    let failed = 0

    // Small concurrency: market data rate-limits, and 50 tickers at once trips it.
    const queue = [...rows]
    const worker = async () => {
      for (;;) {
        const row = queue.shift()
        if (!row) return
        let fields: Record<string, string> = {}
        try {
          const res = await fetchInstrumentData({ ticker: row.ticker, assetClass: 'Equities' })
          if (res.ok) fields = res.fields
          else failed++
        } catch {
          failed++
        }
        out.push(buildInstrument(row, fields))
        setProgress((p) => ({ ...p, done: p.done + 1, failed }))
      }
    }
    await Promise.all([worker(), worker(), worker()])

    // Keep the file's order, not whichever fetch finished first.
    const order = new Map(rows.map((r, i) => [r.ticker, i]))
    out.sort((a, b) => (order.get(a.ticker) ?? 0) - (order.get(b.ticker) ?? 0))
    setBuilt(out)
    setBusy(false)
  }

  const add = () => {
    if (!built?.length) return
    addMany(built)
    setDone(t.admin.importDone(built.length))
    setBuilt(null)
  }

  const fetched = built ? built.filter((i) => i.details.lastPrice).length : 0

  return (
    <div className="mt-4 rounded-2xl border border-teal/30 bg-surface p-5 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-text">{t.admin.rankingTitle}</h2>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted">{t.admin.rankingHint}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={template}
            className="rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:text-teal"
          >
            {t.admin.importDownload}
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="rounded-xl bg-teal px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? t.admin.rankingFetching(progress.done, progress.total) : t.admin.rankingUpload}
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv,text/plain"
          className="hidden"
          onChange={onFile}
        />
      </div>

      {done && <p className="mt-3 text-sm font-medium text-teal">{done}</p>}
      {error && <p className="mt-3 text-sm font-medium text-red">{error}</p>}

      {built && built.length > 0 && (
        <div className="mt-4 rounded-xl border border-border bg-surface2/60 p-4">
          <p className="text-sm font-medium text-text">
            {t.admin.importPreview(built.length, 0)}
            <span className="ml-2 font-mono text-xs text-muted">
              · {t.admin.rankingFilled(fetched, built.length)}
            </span>
          </p>
          <ul className="mt-3 max-h-56 space-y-1 overflow-y-auto pr-2 font-mono text-[11px] text-muted tnum">
            {built.map((i) => (
              <li key={i.id} className="truncate">
                {i.ticker} · {i.name} · {i.details.lastPrice || '—'} →{' '}
                {i.details.priceTarget || '—'} · {i.details.potentialReturn || '—'}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={add}
            className="mt-4 rounded-xl bg-teal px-5 py-2 text-sm font-semibold text-white shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card"
          >
            {t.admin.importAdd(built.length)}
          </button>
        </div>
      )}
    </div>
  )
}

export function buildInstrument(row: Row, fields: Record<string, string>): ManagedInstrument {
  const details: Record<string, string> = { ...fields }
  // `name` rides in on the market-data payload but belongs on the instrument.
  delete details.name

  // Their view wins over the fetched description; everything else is ours.
  if (row.description) details.description = row.description
  if (row.recBuyPct) details.recBuyPct = row.recBuyPct
  if (row.priceTarget) details.priceTarget = row.priceTarget
  details.researchSource = 'Gletir'

  // Recompute the potential return off the LIVE price rather than trusting the
  // file's — theirs is stamped at send time and drifts with the market.
  const target = numOr(row.priceTarget)
  const spot = numOr(fields.lastPrice)
  if (target != null && spot != null && spot > 0) {
    const pct = (target / spot - 1) * 100
    details.potentialReturn = `${pct >= 0 ? '+' : '−'}${Math.abs(pct).toFixed(1)}%`
  }

  const beta = fields.beta
  const vec = deriveRiskVector('global', 'Equities', beta ? { beta } : {})
  const def = deriveDefaults('global', 'Equities')

  return {
    id: `rank-eq-${row.ticker.toLowerCase()}`,
    name: fields.name || row.ticker,
    ticker: row.ticker,
    region: 'global',
    assetClass: 'Equities',
    kind: fields.kind || 'Single stock',
    sigmaLoad: vec.sigmaLoad,
    alphaLoad: vec.alphaLoad,
    lambdaLoad: vec.lambdaLoad,
    liquidityTier: def.liquidityTier,
    lockupMonths: def.lockupMonths,
    visible: true,
    emphasized: false,
    details,
  }
}
