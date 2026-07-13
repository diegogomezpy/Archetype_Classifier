import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { getSessionStore, type SessionRecord } from '../lib/storage'
import { reclassifyScores } from '../lib/scoring'
import { useArchetypeConfig } from '../lib/archetypeConfig'
import { useDirectory } from '../lib/directory'
import { dateLocale, useLang, useT } from '../i18n/i18n'
import { localizedArchetype } from '../i18n/content'
import { ARCHETYPE_COLORS } from '../data/archetypes'
import AppNav from '../components/AppNav'

function fmtDate(iso: string, locale: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })
}

function initials(name: string): string {
  return name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
}
function hexA(hex: string, alpha: number): string {
  return `${hex}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`
}

// One client's play history: every session, newest first. Scoped to the
// logged-in advisor — a session for another advisor's client is never shown.
export default function AdvisorClientPage() {
  const t = useT()
  const { lang } = useLang()
  const { config } = useArchetypeConfig()
  const { loggedInAdvisorId } = useDirectory()
  const { clientId } = useParams<{ clientId: string }>()
  const [sessions, setSessions] = useState<SessionRecord[] | null>(null)

  // Scope the fetch to (advisor, client) so another advisor's client returns
  // nothing even via a hand-typed URL.
  useEffect(() => {
    if (!loggedInAdvisorId || !clientId) return
    let alive = true
    getSessionStore()
      .listSessions({ advisorId: loggedInAdvisorId, clientId })
      .then((s) => alive && setSessions(s))
      .catch(() => alive && setSessions([]))
    return () => {
      alive = false
    }
  }, [loggedInAdvisorId, clientId])

  const mySessions = useMemo(
    () => (sessions ?? []).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [sessions],
  )
  const clientName = mySessions[0]?.clientLabel ?? null
  // The client's current classification (newest session) drives the header accent.
  const latestLive = mySessions[0] ? reclassifyScores(mySessions[0].scores, config.shapeVectors) : null
  const latestColor = latestLive ? ARCHETYPE_COLORS[latestLive.archetype] : '#8A8D99'
  const latestName = latestLive ? localizedArchetype(latestLive.archetype, lang).name : null

  const handleDelete = (s: SessionRecord) => {
    void getSessionStore()
      .deleteSession(s.id)
      .then(() => setSessions((prev) => prev?.filter((x) => x.id !== s.id) ?? prev))
  }

  // Not signed in → back to the advisor home.
  if (!loggedInAdvisorId) return <Navigate to="/advisor" replace />

  return (
    <div>
      <AppNav />
      <div className="mx-auto w-full max-w-3xl px-6 py-8">
      <Link to="/advisor" className="text-sm text-muted transition-colors hover:text-text">
        {t.clientHistory.back}
      </Link>

      <div className="mt-6 flex items-center gap-4">
        <span
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-semibold shadow-soft"
          style={{ backgroundColor: hexA(latestColor, 0.14), color: latestColor }}
        >
          {clientName ? initials(clientName) : '—'}
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-3xl font-semibold tracking-tight text-text">
            {clientName ?? '—'}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted">
            {latestName && (
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: latestColor }}
                />
                {latestName}
              </span>
            )}
            {latestName && <span className="text-muted/40">·</span>}
            <span>{t.advisorClients.sessions(mySessions.length)}</span>
          </p>
        </div>
      </div>
      <p className="mt-4 text-sm text-muted">{t.clientHistory.sessionsSub}</p>

      <ul className="mt-8 space-y-3">
        {mySessions.map((s) => {
          const live = reclassifyScores(s.scores, config.shapeVectors)
          const archetype = localizedArchetype(live.archetype, lang)
          const sColor = ARCHETYPE_COLORS[live.archetype]
          return (
            <li key={s.id} className="group relative">
              <Link
                to={`/advisor/session/${s.id}`}
                className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-5 pr-14 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: sColor }}
                />
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
