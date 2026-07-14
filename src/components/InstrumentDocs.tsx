import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import {
  deleteDoc,
  docDownloadUrl,
  formatBytes,
  listDocs,
  uploadDoc,
  type DocMeta,
} from '../lib/documents'
import { useT } from '../i18n/i18n'

const MAX_MB = 20

// Attached documents for one instrument. `editable` = admin (upload + delete);
// otherwise read-only download list (advisor), hidden when there's nothing.
export default function InstrumentDocs({
  instrumentId,
  editable,
}: {
  instrumentId: string
  editable: boolean
}) {
  const t = useT()
  const [docs, setDocs] = useState<DocMeta[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let alive = true
    listDocs(instrumentId)
      .then((d) => alive && setDocs(d))
      .catch(() => alive && setDocs([]))
    return () => {
      alive = false
    }
  }, [instrumentId])

  const onUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setErr(null)
    if (file.size > MAX_MB * 1024 * 1024) {
      setErr(t.docs.tooBig(MAX_MB))
      if (fileRef.current) fileRef.current.value = ''
      return
    }
    setBusy(true)
    try {
      const meta = await uploadDoc(instrumentId, file)
      setDocs((d) => [...(d ?? []), meta])
    } catch {
      setErr(t.docs.uploadFailed)
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const remove = async (id: string) => {
    setDocs((d) => d?.filter((x) => x.id !== id) ?? null)
    await deleteDoc(id).catch(() => {})
  }

  // Advisor side stays out of the way when there's nothing to show.
  if (!editable && (docs === null || docs.length === 0)) return null

  return (
    <div className={editable ? 'mt-8' : 'mt-3 border-t border-border/70 pt-3'}>
      <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted">{t.docs.title}</p>
      <ul className="mt-2 space-y-1.5">
        {(docs ?? []).map((d) => (
          <li key={d.id} className="flex items-center gap-3 text-sm">
            <a
              href={docDownloadUrl(d.id)}
              download
              className="min-w-0 flex-1 truncate font-medium text-teal hover:underline"
            >
              {d.name}
            </a>
            <span className="shrink-0 font-mono text-[11px] text-muted tnum">
              {formatBytes(d.size)}
            </span>
            {editable && (
              <button
                type="button"
                aria-label={t.docs.remove}
                title={t.docs.remove}
                onClick={() => remove(d.id)}
                className="shrink-0 rounded-lg px-1.5 py-1 text-xs text-muted/60 transition-colors hover:bg-red/10 hover:text-red"
              >
                ✕
              </button>
            )}
          </li>
        ))}
        {editable && docs !== null && docs.length === 0 && (
          <li className="text-xs italic text-muted">{t.docs.none}</li>
        )}
      </ul>
      {editable && (
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="rounded-xl border border-teal/40 bg-teal/10 px-4 py-2 text-sm font-medium text-teal transition-colors hover:bg-teal/15 disabled:opacity-50"
          >
            {busy ? t.docs.uploading : t.docs.upload}
          </button>
          <input ref={fileRef} type="file" className="hidden" onChange={onUpload} />
          {err ? (
            <span className="text-xs text-red">{err}</span>
          ) : (
            <span className="text-xs text-muted">{t.docs.hint(MAX_MB)}</span>
          )}
        </div>
      )}
    </div>
  )
}
