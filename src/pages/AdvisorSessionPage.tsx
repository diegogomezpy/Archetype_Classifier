import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import AdvisorDashboard from '../components/AdvisorDashboard'
import { getSessionStore, type SessionRecord } from '../lib/storage'
import { reclassifyScores } from '../lib/scoring'
import { useArchetypeConfig } from '../lib/archetypeConfig'
import { useDirectory } from '../lib/directory'
import { dateLocale, useLang, useT } from '../i18n/i18n'
import AppNav from '../components/AppNav'

function fmtDate(iso: string, locale: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })
}

// One client session, rendered as the full two-panel advisor dashboard.
export default function AdvisorSessionPage() {
  const t = useT()
  const { lang } = useLang()
  const { config } = useArchetypeConfig()
  const { loggedInAdvisorId } = useDirectory()
  const { id } = useParams<{ id: string }>()
  const [session, setSession] = useState<SessionRecord | null | 'loading'>('loading')

  useEffect(() => {
    let alive = true
    if (!id) {
      setSession(null)
      return
    }
    getSessionStore()
      .getSession(id)
      .then((s) => alive && setSession(s))
      .catch(() => alive && setSession(null))
    return () => {
      alive = false
    }
  }, [id])

  // Must be signed in to view any session.
  if (!loggedInAdvisorId) return <Navigate to="/advisor" replace />

  if (session === 'loading') {
    return <div className="p-10 text-sm text-muted">{t.advisorSession.loading}</div>
  }

  // Scoped: an advisor can only open their own clients' sessions.
  if (session && session !== null && session.advisorId !== loggedInAdvisorId) {
    return <Navigate to="/advisor" replace />
  }

  if (session === null) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-16 text-center">
        <p className="text-base font-medium text-text">{t.advisorSession.notFound}</p>
        <p className="mt-2 text-sm text-muted">{t.advisorSession.notFoundBody}</p>
        <Link
          to="/advisor"
          className="mt-6 inline-block rounded-2xl bg-teal px-6 py-3 text-sm font-semibold text-white shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card"
        >
          {t.advisorSession.allSessions}
        </Link>
      </div>
    )
  }

  // Classification reflects the current admin vectors; the mix (inside the
  // dashboard) reflects the current model portfolios. Any admin change shows here.
  const live = reclassifyScores(session.scores, config.shapeVectors)

  return (
    <div>
      <AppNav />
      {/* Session header bar — advisor navigation, hidden from the print report */}
      <div className="no-print mx-auto flex w-full max-w-5xl items-center gap-3 px-6 pt-6 min-[900px]:px-8">
        <Link
          to={session.clientId ? `/advisor/client/${session.clientId}` : '/advisor'}
          className="text-sm text-muted transition-colors hover:text-text"
        >
          {t.advisorSession.allSessions}
        </Link>
        <span className="ml-auto text-sm text-muted">{fmtDate(session.createdAt, dateLocale(lang))}</span>
      </div>

      <AdvisorDashboard data={live} clientName={session.clientLabel} />
    </div>
  )
}
