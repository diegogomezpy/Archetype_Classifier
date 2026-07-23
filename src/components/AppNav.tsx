import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useT } from '../i18n/i18n'
import { useDirectory } from '../lib/directory'
import BrandMark from './BrandMark'
import LanguageToggle from './LanguageToggle'
import ThemeToggle from './ThemeToggle'

type Props = {
  /** Contextual heading for the current page, shown after the brand divider. */
  title?: string
  /** Small mono line under the title — tickers, counts, dates. */
  meta?: ReactNode
}

// The masthead: brand on the left, optional page context beside it, and every
// global control gathered on the right (sections, language, theme). One row and
// one hairline, so the chrome stays out of the way of the page's own heading.
// The advisor link shows who's selected so context is never a mystery.
export default function AppNav({ title, meta }: Props) {
  const t = useT()
  const { advisors, loggedInAdvisorId } = useDirectory()
  const advisor = advisors.find((a) => a.id === loggedInAdvisorId) ?? null

  const link = ({ isActive }: { isActive: boolean }) =>
    `whitespace-nowrap text-sm transition-colors ${
      isActive ? 'font-medium text-text' : 'text-muted hover:text-text'
    }`

  return (
    <nav className="no-print sticky top-0 z-40 border-b border-border bg-bg/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-2.5 sm:gap-4 sm:px-6">
        {/* Brand */}
        <NavLink to="/" end className="flex shrink-0 items-center gap-2.5">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal text-[#fffefb]"
            aria-hidden="true"
          >
            <BrandMark size={19} />
          </span>
          <span className="font-serif text-xl font-semibold tracking-tight text-text">
            {t.nav.brand}
          </span>
        </NavLink>

        {/* Page context — rendered only when a page supplies one. */}
        {title && (
          <>
            <span aria-hidden className="hidden h-7 w-px shrink-0 bg-border sm:block" />
            <span className="hidden min-w-0 flex-col leading-tight sm:flex">
              <span className="truncate font-serif text-[15px] font-semibold text-text">
                {title}
              </span>
              {meta && <span className="truncate font-mono text-[11px] text-muted">{meta}</span>}
            </span>
          </>
        )}

        {/* Global controls */}
        <div className="ml-auto flex shrink-0 items-center gap-3 sm:gap-4">
          <NavLink to="/" end className={link}>
            {t.nav.test}
          </NavLink>
          <NavLink to="/advisor" className={link}>
            {t.nav.advisor}
            {advisor && <span className="ml-1 opacity-70">· {advisor.name.split(' ')[0]}</span>}
          </NavLink>
          <NavLink to="/admin" className={link}>
            {t.nav.admin}
          </NavLink>
          <LanguageToggle inline />
          <ThemeToggle inline />
        </div>
      </div>
    </nav>
  )
}
