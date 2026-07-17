import { useRef, useState, type ChangeEvent } from 'react'
import { useCatalog } from '../lib/catalog'
import { parseBulletin } from '../lib/bulletinParse'
import { extractPdfLines } from '../lib/pdfText'
import type { ImportResult } from '../lib/importSchema'
import { useT } from '../i18n/i18n'

const num = (n: number) => (n >= 0 ? '+' : '') + n.toFixed(2)

// The primary way local instruments get into the catalog: upload the boletín
// PDF, it's parsed into instruments (σ/α/λ auto-derived), you review the
// preview, then add. Nothing about the local menu is baked into the code.
export default function ImportBulletin() {
  const t = useT()
  const { addMany } = useCatalog()
  const [result, setResult] = useState<ImportResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const pdfRef = useRef<HTMLInputElement>(null)

  const onPdf = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    setError(null)
    setDone(null)
    setFileName(file.name)
    try {
      const lines = await extractPdfLines(file)
      const parsed = parseBulletin(lines)
      setResult(parsed)
      if (parsed.instruments.length === 0) setError(t.admin.bulletinNothing)
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
    setFileName(null)
  }

  return (
    <div className="mt-4 rounded-2xl border border-teal/30 bg-surface p-5 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-text">{t.admin.bulletinTitle}</h2>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted">{t.admin.bulletinHint}</p>
        </div>
        <button
          type="button"
          onClick={() => pdfRef.current?.click()}
          disabled={busy}
          className="shrink-0 rounded-xl bg-teal px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? t.admin.importParsing : t.admin.importBulletin}
        </button>
        <input
          ref={pdfRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={onPdf}
        />
      </div>

      {done && <p className="mt-3 text-sm font-medium text-teal">{done}</p>}
      {error && <p className="mt-3 text-sm font-medium text-red">{error}</p>}

      {result && result.instruments.length > 0 && (
        <div className="mt-4 rounded-xl border border-border bg-surface2/60 p-4">
          <p className="text-sm font-medium text-text">
            {t.admin.importPreview(result.instruments.length, result.skipped)}
            {fileName && <span className="ml-2 font-mono text-xs text-muted">· {fileName}</span>}
          </p>
          <p className="mt-1 text-xs text-muted">
            {t.admin.importBulletinSections(result.matched.join(', ') || '—')}
          </p>
          <ul className="mt-3 max-h-56 space-y-1 overflow-y-auto pr-2 font-mono text-[11px] text-muted tnum">
            {result.instruments.map((i) => (
              <li key={i.id} className="truncate">
                {i.name} · {i.kind} · σ {num(i.sigmaLoad)} · α {num(i.alphaLoad)} · λ{' '}
                {num(i.lambdaLoad)}
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={add}
              className="rounded-xl bg-teal px-5 py-2 text-sm font-semibold text-white shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card"
            >
              {t.admin.importAdd(result.instruments.length)}
            </button>
            <button
              type="button"
              onClick={() => {
                setResult(null)
                setFileName(null)
              }}
              className="rounded-xl border border-border bg-surface px-4 py-2 text-sm font-medium text-muted transition-colors hover:text-text"
            >
              {t.admin.bulletinDiscard}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
