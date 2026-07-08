import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getSessionStore, type SessionRecord } from '../lib/storage'
import { reclassifyScores } from '../lib/scoring'
import { useArchetypeConfig } from '../lib/archetypeConfig'
import { dateLocale, useLang, useT } from '../i18n/i18n'
import { localizedArchetype } from '../i18n/content'

function fmtDate(iso: string, locale: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })
}

// Advisor home: every completed client session, newest first. Click through to
// the full two-panel dashboard, or delete a session outright. (Auth gate
// arrives with the Firebase backend.)
export default function AdvisorListPage() {
  const t = useT()
  const { lang } = useLang()
  const { config } = useArchetypeConfig()
  const [sessions, setSessions] = useState<SessionRecord[] | null>(null)

  useEffect(() => {
    let alive = true
    getSessionStore()
      .listSessions()
      .then((s) => alive && setSessions(s))
      .catch(() => alive && setSessions([]))
    return () => {
      alive = false
    }
  }, [])

  const handleDelete = (s: SessionRecord) => {
    if (!window.confirm(t.advisorList.deleteConfirm(s.clientLabel || t.advisorList.unnamed))) return
    void getSessionStore()
      .deleteSession(s.id)
      .then(() => setSessions((prev) => prev?.filter((x) => x.id !== s.id) ?? prev))
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12">
      <div className="flex items-center gap-3">
        <span className="rounded-md bg-text px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.16em] text-bg">
          {t.common.advisorView}
        </span>
        <div className="ml-auto flex items-center gap-5">
          <Link to="/admin" className="text-sm text-muted transition-colors hover:text-text">
            {t.common.adminConsole}
          </Link>
          <Link to="/" className="text-sm text-muted transition-colors hover:text-text">
            {t.common.clientTest}
          </Link>
        </div>
      </div>

      <h1 className="mt-6 text-3xl font-semibold tracking-tight text-text">
        {t.advisorList.title}
      </h1>
      <p className="mt-2 text-sm text-muted">
        {sessions === null ? t.advisorList.loading : t.advisorList.count(sessions.length)}
      </p>

      {sessions !== null && sessions.length === 0 && (
        <div className="mt-10 rounded-2xl border border-border bg-surface p-8 text-center shadow-soft">
          <p className="text-base font-medium text-text">{t.advisorList.emptyTitle}</p>
          <p className="mt-2 text-sm text-muted">{t.advisorList.emptyBody}</p>
          <Link
            to="/"
            className="mt-6 inline-block rounded-2xl bg-teal px-6 py-3 text-sm font-semibold text-white shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card"
          >
            {t.advisorList.openTest}
          </Link>
        </div>
      )}

      <ul className="mt-8 space-y-3">
        {sessions?.map((s) => {
          // Re-derive the classification from the stored scores against the
          // current admin vectors, so an admin retune shows up here immediately.
          const live = reclassifyScores(s.scores, config.shapeVectors)
          const archetype = localizedArchetype(live.archetype, lang)
          const secondary =
            live.isBlend && live.secondaryArchetype
              ? localizedArchetype(live.secondaryArchetype, lang)
              : null
          return (
            <li key={s.id} className="group relative">
              <Link
                to={`/advisor/session/${s.id}`}
                className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-5 pr-14 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5">
                    <span className="truncate text-base font-semibold text-text">
                      {s.clientLabel || t.advisorList.unnamed}
                    </span>
                    {live.tentative && (
                      <span className="shrink-0 rounded-full border border-amber/40 bg-amber/[0.07] px-2 py-0.5 text-[11px] font-medium text-amber">
                        {t.advisorList.tentativeBadge}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {archetype.name}
                    {secondary ? ` · ${secondary.name}` : ''}
                    {' — '}
                    {fmtDate(s.createdAt, dateLocale(lang))}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono text-sm font-medium text-text tnum">
                    {Math.round(live.confidence * 100)}%
                  </p>
                  <p className="mt-0.5 text-xs text-muted">{t.advisorList.confidence}</p>
                </div>
                <span aria-hidden className="text-muted">
                  →
                </span>
              </Link>
              {/* Delete — outside the Link so it can't trigger navigation */}
              <button
                type="button"
                aria-label={`${t.advisorList.delete}: ${s.clientLabel || t.advisorList.unnamed}`}
                title={t.advisorList.delete}
                onClick={() => handleDelete(s)}
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1.5 text-muted/50 transition-colors hover:bg-red/10 hover:text-red"
              >
                <span aria-hidden>✕</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
