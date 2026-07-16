import { useRef, useState, type ChangeEvent } from 'react'
import { categoriesForRegion, type Category, type Region } from '../lib/instruments'
import { useCatalog } from '../lib/catalog'
import { downloadText, parseCsv } from '../lib/csv'
import { parseInstruments, templateCsv, type ImportResult } from '../lib/importSchema'
import { parseBulletin } from '../lib/bulletinParse'
import { extractPdfLines } from '../lib/pdfText'
import { useLang, useT } from '../i18n/i18n'
import { categoryLabel, regionLabel } from '../i18n/content'

const REGIONS: Region[] = ['global', 'local']
const selCls =
  'rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text shadow-soft outline-none focus:ring-2 focus:ring-teal/40'
const labelCls = 'flex flex-col gap-1 text-xs font-medium text-muted'
const num = (n: number) => (n >= 0 ? '+' : '') + n.toFixed(2)

// Load securities from a spreadsheet: pick a market + category, download the
// column template (or use a Bloomberg export with matching headers), then upload
// the filled CSV. Rows map by header (aliases handle Bloomberg names) and any
// blank σ/α/λ are auto-derived.
export default function ImportInstruments() {
  const t = useT()
  const { lang } = useLang()
  const { addMany } = useCatalog()
  const [region, setRegion] = useState<Region>('global')
  const [category, setCategory] = useState<Category>('Equities')
  const [result, setResult] = useState<ImportResult | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pdfMode, setPdfMode] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const pdfRef = useRef<HTMLInputElement>(null)

  const pickRegion = (r: Region) => {
    setRegion(r)
    setCategory(categoriesForRegion(r)[0])
    setResult(null)
    setDone(null)
    setError(null)
  }

  const download = () => {
    const slug = String(category).toLowerCase().replace(/\s+/g, '-')
    downloadText(`template-${region}-${slug}.csv`, templateCsv(region, category))
  }

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    setError(null)
    setPdfMode(false)
    setResult(parseInstruments(region, category, parseCsv(text)))
    setDone(null)
  }

  const onPdf = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    setError(null)
    setDone(null)
    setPdfMode(true)
    try {
      const lines = await extractPdfLines(file)
      setResult(parseBulletin(lines))
    } catch (err) {
      console.error('bulletin parse:', err)
      setError(t.admin.importBulletinError)
      setResult(null)
    } finally {
      setBusy(false)
      if (pdfRef.current) pdfRef.current.value = ''
    }
  }

  const add = () => {
    if (!result || result.instruments.length === 0) return
    addMany(result.instruments)
    setDone(t.admin.importDone(result.instruments.length))
    setResult(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <details className="mt-4 rounded-2xl border border-border bg-surface/60 shadow-soft">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-text">
        {t.admin.importTitle}
      </summary>
      <div className="border-t border-border/60 p-4">
        <p className="mb-4 max-w-2xl text-xs leading-relaxed text-muted">{t.admin.importHint}</p>
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
                setResult(null)
                setDone(null)
              }}
            >
              {categoriesForRegion(region).map((c) => (
                <option key={c} value={c}>
                  {categoryLabel(c, region, lang)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={download}
            className="rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:text-teal"
          >
            {t.admin.importDownload}
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-lg border border-teal/40 bg-teal/10 px-3.5 py-2 text-sm font-medium text-teal transition-colors hover:bg-teal/15"
          >
            {t.admin.importUpload}
          </button>
          {region === 'local' && (
            <button
              type="button"
              onClick={() => pdfRef.current?.click()}
              disabled={busy}
              className="rounded-lg border border-teal/40 bg-teal/10 px-3.5 py-2 text-sm font-medium text-teal transition-colors hover:bg-teal/15 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? t.admin.importParsing : t.admin.importBulletin}
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv,text/plain"
            className="hidden"
            onChange={onFile}
          />
          <input ref={pdfRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={onPdf} />
        </div>

        {region === 'local' && (
          <p className="mt-3 max-w-2xl text-xs leading-relaxed text-muted">{t.admin.importBulletinHint}</p>
        )}

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
