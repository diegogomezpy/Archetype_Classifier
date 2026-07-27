import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useT } from '../i18n/i18n'

// ---------------------------------------------------------------------------
// Spanish coverage for fetched free text
// ---------------------------------------------------------------------------
// Company descriptions and sectors come from the market feed in English and are
// translated once at fetch time, then cached on the instrument. The free engine
// is capped per day, so a bulk import translates the first handful and silently
// leaves the rest English — and since a re-fetch only re-translates when the
// SOURCE text changes, they would stay English forever. This panel shows the
// gap and runs a resumable backfill over it.

type Coverage = { translated: number; missing: number }
type RunResult = { updated: number; failed: number; remaining: number; quotaExhausted: boolean }

export default function TranslationBackfill() {
  const t = useT().adminTranslate
  const [cov, setCov] = useState<Coverage | null>(null)
  const [running, setRunning] = useState(false)
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    try {
      setCov(await api.get<Coverage>('/market-data/translate'))
    } catch {
      setCov(null)
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const run = async () => {
    setRunning(true)
    setMsg('')
    try {
      const r = await api.post<RunResult>('/market-data/translate', {})
      setMsg(r.quotaExhausted ? t.quota(r.remaining) : t.done(r.updated))
      await load()
    } catch {
      setMsg(t.failed)
    } finally {
      setRunning(false)
    }
  }

  const missing = cov?.missing ?? 0

  return (
    <div className="mt-8 rounded-2xl border border-border bg-surface p-6 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-text">{t.title}</h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">{t.body}</p>
          {cov && (
            <p className={`mt-2 font-mono text-xs tnum ${missing > 0 ? 'text-amber' : 'text-muted'}`}>
              {missing > 0 ? t.coverage(cov.translated, missing) : t.allDone}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={run}
          disabled={running || missing === 0}
          className="shrink-0 rounded-full bg-teal px-4 py-1.5 text-sm font-semibold text-white shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card disabled:cursor-not-allowed disabled:opacity-40"
        >
          {running ? t.running : t.run}
        </button>
      </div>
      {msg && <p className="mt-3 text-sm text-teal">{msg}</p>}
    </div>
  )
}
