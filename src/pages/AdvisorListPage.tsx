import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getSessionStore, type SessionRecord } from '../lib/storage'
import { reclassifyScores } from '../lib/scoring'
import { useArchetypeConfig } from '../lib/archetypeConfig'
import { useDirectory, type Advisor } from '../lib/directory'
import { dateLocale, useLang, useT } from '../i18n/i18n'
import { localizedArchetype } from '../i18n/content'
import AppNav from '../components/AppNav'

function fmtDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ── One-click advisor picker (no login, remembered on this device) ──────────

function AdvisorPicker({ advisors }: { advisors: Advisor[] }) {
  const t = useT()
  const { login } = useDirectory()

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-text">{t.advisorPicker.title}</h1>
      <p className="mt-2 text-sm text-muted">{t.advisorPicker.subtitle}</p>

      {advisors.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-border bg-surface p-8 text-center shadow-soft">
          <p className="text-sm text-muted">{t.advisorPicker.noAdvisors}</p>
          <Link
            to="/admin/advisors"
            className="mt-5 inline-block rounded-2xl bg-teal px-6 py-3 text-sm font-semibold text-white shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card"
          >
            {t.advisorPicker.goAdmin}
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {advisors.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => login(a.id)}
              className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-5 text-left shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-teal/40 hover:shadow-card"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-teal/12 text-base font-semibold text-teal">
                {a.name
                  .split(' ')
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-base font-semibold text-text">{a.name}</span>
              </span>
              <span aria-hidden className="ml-auto text-muted">
                →
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Client list for the selected advisor ─────────────────────────────────────

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

  // If the selected advisor was deleted, clear the selection.
  useEffect(() => {
    if (loggedInAdvisorId && !advisor) logout()
  }, [loggedInAdvisorId, advisor, logout])

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

  return (
    <div>
      <AppNav />
      {!advisor ? (
        <AdvisorPicker advisors={advisors} />
      ) : (
        <div className="mx-auto w-full max-w-3xl px-6 py-10">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-text">
              {t.advisorClients.title}
            </h1>
            <div className="ml-auto flex items-center gap-3 text-sm">
              <span className="text-muted">
                {t.advisorClients.signedInAs}{' '}
                <span className="font-medium text-text">{advisor.name}</span>
              </span>
              <button
                type="button"
                onClick={logout}
                className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted transition-colors hover:text-text"
              >
                {t.advisorClients.logout}
              </button>
            </div>
          </div>
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
                      <span className="truncate text-base font-semibold text-text">
                        {client.name}
                      </span>
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
      )}
    </div>
  )
}
