import { useRef, useState, type ChangeEvent } from 'react'
import { categoriesForRegion, type AssetClass, type Category, type Region } from '../lib/instruments'
import { useCatalog, type ManagedInstrument } from '../lib/catalog'
import { downloadText, parseCsv } from '../lib/csv'
import { isAutoFillable, parseInstruments, templateCsv, type ImportResult } from '../lib/importSchema'
import { parseBulletin } from '../lib/bulletinParse'
import { extractPdfLines } from '../lib/pdfText'
import { fetchInstrumentData } from '../lib/marketData'
import { deriveRiskVector } from '../lib/riskDerivation'
import { useLang, useT } from '../i18n/i18n'
import { categoryLabel, regionLabel } from '../i18n/content'

const REGIONS: Region[] = ['global', 'local']
const selCls =
  'rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text shadow-soft outline-none focus:ring-2 focus:ring-teal/40'
const btnCls =
  'rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:text-teal disabled:cursor-not-allowed disabled:opacity-50'
const labelCls = 'flex flex-col gap-1 text-xs font-medium text-muted'
const num = (n: number) => (n >= 0 ? '+' : '') + n.toFixed(2)

// The single loading surface. Three paths, picked by what you choose:
//  • global + Equities/Crypto — the template is just Ticker + Descripción; a
//    ticker is all market data needs, so the rest is fetched on import.
//  • local — upload the Cadiem boletín PDF and it's parsed into instruments.
//  • anything else — the full column template (Bloomberg field names accepted).
export default function ImportInstruments() {
  const t = useT()
  const { lang } = useLang()
  const { addMany } = useCatalog()
  const [region, setRegion] = useState<Region>('global')
  const [category, setCategory] = useState<Category>('Equities')
  const [result, setResult] = useState<ImportResult | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pdfMode, setPdfMode] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const pdfRef = useRef<HTMLInputElement>(null)

  const autoFill = isAutoFillable(region, category)

  const reset = () => {
    setResult(null)
    setDone(null)
    setError(null)
  }
  const pickRegion = (r: Region) => {
    setRegion(r)
    setCategory(categoriesForRegion(r)[0])
    reset()
  }

  const download = () => {
    const slug = String(category).toLowerCase().replace(/\s+/g, '-')
    downloadText(`template-${region}-${slug}.csv`, templateCsv(region, category))
  }

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    if (fileRef.current) fileRef.current.value = ''
    reset()
    setPdfMode(false)
    const parsed = parseInstruments(region, category, parseCsv(text))
    if (!autoFill || parsed.instruments.length === 0) {
      setResult(parsed)
      return
    }
    // Ticker is all we were given — go and get the rest.
    setBusy(t.admin.importFetching(0, parsed.instruments.length))
    const filled = await autofillAll(parsed.instruments, (d, n) =>
      setBusy(t.admin.importFetching(d, n)),
    )
    setBusy(null)
    setResult({ ...parsed, instruments: filled })
  }

  const onPdf = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    reset()
    setPdfMode(true)
    setBusy(t.admin.importParsing)
    try {
      const lines = await extractPdfLines(file)
      const parsed = parseBulletin(lines)
      setResult(parsed)
      if (parsed.instruments.length === 0) setError(t.admin.bulletinNothing)
    } catch (err) {
      console.error('bulletin parse:', err)
      setError(t.admin.importBulletinError)
    } finally {
      setBusy(null)
      if (pdfRef.current) pdfRef.current.value = ''
    }
  }

  const add = () => {
    if (!result || result.instruments.length === 0) return
    addMany(result.instruments)
    setDone(t.admin.importDone(result.instruments.length))
    setResult(null)
  }

  return (
    <details className="mt-4 rounded-2xl border border-border bg-surface/60 shadow-soft">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-text">
        {t.admin.importTitle}
      </summary>
      <div className="border-t border-border/60 p-4">
        <p className="mb-4 max-w-2xl text-xs leading-relaxed text-muted">
          {autoFill
            ? t.admin.importHintAuto
            : region === 'local'
              ? t.admin.importHintLocal
              : t.admin.importHint}
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className={labelCls}>
            {t.admin.region}
            <select className={selCls} value={region} onChange={(e) => pickRegion(e.target.value as Region)}>
              {REGIONS.map((r) => (
                <option key={r} value={r}>
                  {regionLabel(r, lang)}
                </option>
              ))}
            </select>
          </label>
          <label className={labelCls}>
            {t.admin.assetClass}
            <select
              className={selCls}
              value={category}
              onChange={(e) => {
                setCategory(e.target.value as Category)
                reset()
              }}
            >
              {categoriesForRegion(region).map((c) => (
                <option key={c} value={c}>
                  {categoryLabel(c, region, lang)}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={download} className={btnCls} disabled={!!busy}>
            {t.admin.importDownload}
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={!!busy}
            className="rounded-lg border border-teal/40 bg-teal/10 px-3.5 py-2 text-sm font-medium text-teal transition-colors hover:bg-teal/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t.admin.importUpload}
          </button>
          {region === 'local' && (
            <button type="button" onClick={() => pdfRef.current?.click()} disabled={!!busy} className={btnCls}>
              {t.admin.importBulletin}
            </button>
          )}
          <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={onFile} />
          <input ref={pdfRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={onPdf} />
        </div>

        {busy && <p className="mt-3 text-sm font-medium text-muted">{busy}</p>}
        {done && <p className="mt-3 text-sm font-medium text-teal">{done}</p>}
        {error && <p className="mt-3 text-sm font-medium text-red">{error}</p>}

        {result && (
          <div className="mt-4 rounded-xl border border-border bg-surface p-4">
            <p className="text-sm font-medium text-text">
              {t.admin.importPreview(result.instruments.length, result.skipped)}
            </p>
            <p className="mt-1 text-xs text-muted">
              {pdfMode
                ? t.admin.importBulletinSections(result.matched.join(', ') || '—')
                : t.admin.importMatched(result.matched.length)}
              {!pdfMode && result.unmatched.length > 0 &&
                ` · ${t.admin.importUnmatched(result.unmatched.join(', '))}`}
            </p>
            {result.instruments.length > 0 && (
              <ul className="mt-3 max-h-44 space-y-1 overflow-y-auto pr-2 font-mono text-[11px] text-muted tnum">
                {result.instruments.slice(0, 12).map((i) => (
                  <li key={i.id} className="truncate">
                    {i.name} · σ {num(i.sigmaLoad)} · α {num(i.alphaLoad)} · λ {num(i.lambdaLoad)}
                  </li>
                ))}
                {result.instruments.length > 12 && <li>+{result.instruments.length - 12}…</li>}
              </ul>
            )}
            <button
              type="button"
              onClick={add}
              disabled={result.instruments.length === 0}
              className="mt-4 rounded-xl bg-teal px-5 py-2 text-sm font-semibold text-white shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t.admin.importAdd(result.instruments.length)}
            </button>
          </div>
        )}
      </div>
    </details>
  )
}

/**
 * Fill each ticker-only row from market data. Anything the file supplied wins —
 * blank means "use theirs". Concurrency stays low: market data rate-limits.
 */
async function autofillAll(
  items: ManagedInstrument[],
  onProgress: (done: number, total: number) => void,
): Promise<ManagedInstrument[]> {
  const queue = items.map((inst, i) => ({ inst, i }))
  const out: ManagedInstrument[] = new Array(items.length)
  let done = 0

  const worker = async () => {
    for (;;) {
      const job = queue.shift()
      if (!job) return
      const { inst, i } = job
      let fields: Record<string, string> = {}
      try {
        const res = await fetchInstrumentData({
          ticker: inst.ticker,
          assetClass: inst.assetClass as AssetClass,
        })
        if (res.ok) fields = res.fields
      } catch {
        /* leave the row as the file gave it */
      }
      const { name, ...rest } = fields
      const details = { ...rest, ...inst.details } // the file overrides the feed
      const vec = details.beta
        ? deriveRiskVector(inst.region ?? 'global', inst.assetClass, { beta: details.beta })
        : null
      out[i] = {
        ...inst,
        name: inst.details.name || name || inst.name,
        kind: inst.kind || details.kind,
        ...(vec ?? {}),
        details,
      }
      done++
      onProgress(done, items.length)
    }
  }
  await Promise.all([worker(), worker(), worker()])
  return out.filter(Boolean)
}
