import { Link, NavLink } from 'react-router-dom'
import { useT } from '../i18n/i18n'

// Shared header for the admin console: the Admin badge, cross-links back out,
// and the Instruments / Archetypes section tabs.
export default function AdminNav() {
  const t = useT()

  const tab = (active: boolean) =>
    `rounded-full px-3.5 py-1.5 text-sm font-medium transition-all ${
      active
        ? 'bg-teal/15 text-teal shadow-soft'
        : 'text-muted hover:text-text'
    }`

  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="rounded-md bg-text px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.16em] text-bg">
          {t.common.admin}
        </span>
        <div className="ml-auto flex items-center gap-5">
          <Link to="/advisor" className="text-sm text-muted transition-colors hover:text-text">
            {t.common.advisorSessions}
          </Link>
          <Link to="/" className="text-sm text-muted transition-colors hover:text-text">
            {t.common.clientTest}
          </Link>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-1 border-b border-border pb-3">
        <NavLink to="/admin" end className={({ isActive }) => tab(isActive)}>
          {t.adminNav.instruments}
        </NavLink>
        <NavLink to="/admin/archetypes" className={({ isActive }) => tab(isActive)}>
          {t.adminNav.archetypes}
        </NavLink>
        <NavLink to="/admin/advisors" className={({ isActive }) => tab(isActive)}>
          {t.adminNav.advisors}
        </NavLink>
      </div>
    </div>
  )
}
