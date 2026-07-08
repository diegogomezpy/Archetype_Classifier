import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getSessionStore, type SessionRecord } from '../lib/storage'
import { reclassifyScores } from '../lib/scoring'
import { useArchetypeConfig } from '../lib/archetypeConfig'
import { useDirectory, type Advisor } from '../lib/directory'
import { dateLocale, useLang, useT } from '../i18n/i18n'
import { localizedArchetype } from '../i18n/content'

function fmtDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ── Login gate ───────────────────────────────────────────────────────────────

function AdvisorLogin({ advisors }: { advisors: Advisor[] }) {
  const t = useT()
  const { login } = useDirectory()
  const [advisorId, setAdvisorId] = useState('')
  const [passcode, setPasscode] = useState('')
  const [error, setError] = useState(false)

  const submit = () => {
    if (!advisorId) return
    if (!login(advisorId, passcode)) setError(true)
  }

  return (
    <div className="mx-auto w-full max-w-md px-6 py-16">
      <div className="flex items-center gap-3">
        <span className="rounded-md bg-text px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.16em] text-bg">
          {t.common.advisorView}
        </span>
        <Link to="/" className="ml-auto text-sm text-muted transition-colors hover:text-text">
          {t.common.clientTest}
        </Link>
      </div>

      <h1 className="mt-8 text-3xl font-semibold tracking-tight text-text">{t.advisorAuth.title}</h1>
      <p className="mt-2 text-sm text-muted">{t.advisorAuth.subtitle}</p>

      {advisors.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-border bg-surface p-6 text-center shadow-soft">
          <p className="text-sm text-muted">{t.advisorAuth.noAdvisors}</p>
          <Link
            to="/admin/advisors"
            className="mt-5 inline-block rounded-2xl bg-teal px-6 py-3 text-sm font-semibold text-white shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card"
          >
            {t.advisorAuth.goAdmin}
          </Link>
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-3">
          <select
            value={advisorId}
            onChange={(e) => {
              setAdvisorId(e.target.value)
              setError(false)
            }}
            aria-label={t.advisorAuth.selectAdvisor}
            className={`w-full rounded-2xl border border-border bg-surface px-5 py-3.5 text-base shadow-soft outline-none focus:ring-2 focus:ring-teal/40 ${
              advisorId ? 'text-text' : 'text-muted/70'
            }`}
          >
            <option value="" disabled>
              {t.advisorAuth.selectAdvisor}
            </option>
            {advisors.map((a) => (
              <option key={a.id} value={a.id} className="text-text">
                {a.name}
              </option>
            ))}
          </select>
          <input
            type="password"
            value={passcode}
            onChange={(e) => {
              setPasscode(e.target.value)
              setError(false)
            }}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder={t.advisorAuth.passcode}
            aria-label={t.advisorAuth.passcode}
            className="w-full rounded-2xl border border-border bg-surface px-5 py-3.5 text-base text-text shadow-soft outline-none placeholder:text-muted/70 focus:ring-2 focus:ring-teal/40"
          />
          {error && <p className="text-xs text-red">{t.advisorAuth.wrongPasscode}</p>}
          <button
            type="button"
            onClick={submit}
            disabled={!advisorId}
            className="mt-1 w-full rounded-2xl bg-teal py-3.5 text-sm font-semibold text-white shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t.advisorAuth.signIn}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Client list (logged-in advisor) ──────────────────────────────────────────

export default function AdvisorListPage() {
  const t = useT()
  const { lang } = useLang()
  const { config } = useArchetypeConfig()
  const { advisors, loggedInAdvisorId, logout, clientsForAdvisor } = useDirectory()
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

  const advisor = advisors.find((a) => a.id === loggedInAdvisorId) ?? null

  // If the logged-in advisor no longer exists (deleted), drop the session.
  useEffect(() => {
    if (loggedInAdvisorId && !advisor) logout()
  }, [loggedInAdvisorId, advisor, logout])

  // Build the client rows: each of the advisor's clients + their session summary.
  const rows = useMemo(() => {
    if (!advisor) return []
    const all = sessions ?? []
    return clientsForAdvisor(advisor.id)
      .map((client) => {
        const cs = all
          .filter((s) => s.clientId === client.id)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        return { client, count: cs.length, latest: cs[0] ?? null }
      })
      .sort((a, b) => (b.latest?.createdAt ?? '').localeCompare(a.latest?.createdAt ?? ''))
  }, [advisor, sessions, clientsForAdvisor])

  if (!loggedInAdvisorId || !advisor) return <AdvisorLogin advisors={advisors} />

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12">
      <div className="flex items-center gap-3">
        <span className="rounded-md bg-text px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.16em] text-bg">
          {t.common.advisorView}
        </span>
        <div className="ml-auto flex items-center gap-4">
          <span className="text-sm text-muted">
            {t.advisorClients.signedInAs}{' '}
            <span className="font-medium text-text">{advisor.name}</span>
          </span>
          <button
            type="button"
            onClick={logout}
            className="text-sm text-muted transition-colors hover:text-text"
          >
            {t.advisorClients.logout}
          </button>
        </div>
      </div>

      <h1 className="mt-6 text-3xl font-semibold tracking-tight text-text">
        {t.advisorClients.title}
      </h1>
      <p className="mt-2 text-sm text-muted">
        {sessions === null ? '…' : t.advisorClients.count(rows.length)}
      </p>

      {sessions !== null && rows.length === 0 && (
        <div className="mt-8 rounded-2xl border border-border bg-surface p-8 text-center shadow-soft">
          <p className="text-sm text-muted">{t.advisorClients.empty}</p>
        </div>
      )}

      <ul className="mt-8 space-y-3">
        {rows.map(({ client, count, latest }) => {
          const live = latest ? reclassifyScores(latest.scores, config.shapeVectors) : null
          const archetype = live ? localizedArchetype(live.archetype, lang) : null
          return (
            <li key={client.id}>
              <Link
                to={`/advisor/client/${client.id}`}
                className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-5 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card"
              >
                <div className="min-w-0 flex-1">
                  <span className="truncate text-base font-semibold text-text">{client.name}</span>
                  <p className="mt-1 text-sm text-muted">
                    {archetype ? archetype.name : '—'}
                    {' · '}
                    {t.advisorClients.sessions(count)}
                  </p>
                </div>
                {latest && (
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-muted">{t.advisorClients.lastPlayed}</p>
                    <p className="font-mono text-xs text-text tnum">
                      {fmtDate(latest.createdAt, dateLocale(lang))}
                    </p>
                  </div>
                )}
                <span aria-hidden className="text-muted">
                  →
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
