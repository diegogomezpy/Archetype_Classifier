import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { getSessionStore, type SessionRecord } from '../lib/storage'
import { reclassifyScores } from '../lib/scoring'
import { useArchetypeConfig } from '../lib/archetypeConfig'
import { useDirectory } from '../lib/directory'
import { dateLocale, useLang, useT } from '../i18n/i18n'
import { localizedArchetype } from '../i18n/content'
import AppNav from '../components/AppNav'

function fmtDate(iso: string, locale: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })
}

// One client's play history: every session, newest first. Scoped to the
// logged-in advisor — a session for another advisor's client is never shown.
export default function AdvisorClientPage() {
  const t = useT()
  const { lang } = useLang()
  const { config } = useArchetypeConfig()
  const { loggedInAdvisorId, clients } = useDirectory()
  const { clientId } = useParams<{ clientId: string }>()
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

  const client = clients.find((c) => c.id === clientId) ?? null

  const mySessions = useMemo(
    () =>
      (sessions ?? [])
        .filter((s) => s.clientId === clientId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [sessions, clientId],
  )

  const handleDelete = (s: SessionRecord) => {
    void getSessionStore()
      .deleteSession(s.id)
      .then(() => setSessions((prev) => prev?.filter((x) => x.id !== s.id) ?? prev))
  }

  // Not signed in, or this client isn't the advisor's → back to the advisor home.
  if (!loggedInAdvisorId) return <Navigate to="/advisor" replace />
  if (client && client.advisorId !== loggedInAdvisorId) return <Navigate to="/advisor" replace />

  return (
    <div>
      <AppNav />
      <div className="mx-auto w-full max-w-3xl px-6 py-8">
      <Link to="/advisor" className="text-sm text-muted transition-colors hover:text-text">
        {t.clientHistory.back}
      </Link>

      <h1 className="mt-6 text-3xl font-semibold tracking-tight text-text">
        {client?.name ?? '—'}
      </h1>
      <p className="mt-2 text-sm text-muted">{t.clientHistory.sessionsSub}</p>

      <ul className="mt-8 space-y-3">
        {mySessions.map((s) => {
          const live = reclassifyScores(s.scores, config.shapeVectors)
          const archetype = localizedArchetype(live.archetype, lang)
          return (
            <li key={s.id} className="group relative">
              <Link
                to={`/advisor/session/${s.id}`}
                className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-5 pr-14 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5">
                    <span className="truncate text-base font-semibold text-text">
                      {archetype.name}
                    </span>
                    {live.tentative && (
                      <span className="shrink-0 rounded-full border border-amber/40 bg-amber/[0.07] px-2 py-0.5 text-[11px] font-medium text-amber">
                        {t.advisorList.tentativeBadge}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted">{fmtDate(s.createdAt, dateLocale(lang))}</p>
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
              <button
                type="button"
                aria-label={t.advisorList.delete}
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
    </div>
  )
}
