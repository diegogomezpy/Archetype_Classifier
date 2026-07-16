import { NavLink } from 'react-router-dom'
import { useT } from '../i18n/i18n'

// Admin section tabs (Instruments / Archetypes / Advisors). The global AppNav
// bar sits above this on every admin page.
export default function AdminNav() {
  const t = useT()

  const tab = ({ isActive }: { isActive: boolean }) =>
    `rounded-full px-3.5 py-1.5 text-sm font-medium transition-all ${
      isActive ? 'bg-teal/15 text-teal shadow-soft' : 'text-muted hover:text-text'
    }`

  return (
    <div className="flex items-center gap-1 border-b border-border pb-3">
      <NavLink to="/admin" end className={tab}>
        {t.adminNav.instruments}
      </NavLink>
      <NavLink to="/admin/archetypes" className={tab}>
        {t.adminNav.archetypes}
      </NavLink>
      <NavLink to="/admin/risk" className={tab}>
        {t.adminNav.risk}
      </NavLink>
      <NavLink to="/admin/advisors" className={tab}>
        {t.adminNav.advisors}
      </NavLink>
    </div>
  )
}
