import { NavLink } from 'react-router-dom'
import { useT } from '../i18n/i18n'
import { useDirectory } from '../lib/directory'

// One consistent top bar across the app (intro, advisor, admin — everywhere
// except mid-game). Three obvious sections; the active one is highlighted.
// The advisor tab shows who's currently selected so context is never a mystery.
export default function AppNav() {
  const t = useT()
  const { advisors, loggedInAdvisorId } = useDirectory()
  const advisor = advisors.find((a) => a.id === loggedInAdvisorId) ?? null

  const tab = ({ isActive }: { isActive: boolean }) =>
    `rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
      isActive ? 'bg-teal text-white shadow-soft' : 'text-muted hover:text-text'
    }`

  return (
    <nav className="no-print sticky top-0 z-40 border-b border-border bg-bg/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-2 px-4 py-2.5 sm:px-6">
        <span className="mr-2 hidden font-mono text-[11px] uppercase tracking-[0.18em] text-muted sm:block">
          {t.nav.brand}
        </span>
        <NavLink to="/" end className={tab}>
          {t.nav.test}
        </NavLink>
        <NavLink to="/advisor" className={tab}>
          {t.nav.advisor}
          {advisor && <span className="ml-1.5 opacity-75">· {advisor.name.split(' ')[0]}</span>}
        </NavLink>
        <NavLink to="/admin" className={tab}>
          {t.nav.admin}
        </NavLink>
      </div>
    </nav>
  )
}
