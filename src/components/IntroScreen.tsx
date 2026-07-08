import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useT } from '../i18n/i18n'

type Props = {
  onStart: (clientLabel: string | null) => void
}

export default function IntroScreen({ onStart }: Props) {
  const t = useT()
  const [name, setName] = useState('')

  const start = () => onStart(name.trim() || null)

  const stats = [
    { value: '10', label: t.intro.statDecisions },
    { value: t.intro.statTimeValue, label: t.intro.statTime },
    { value: '5', label: t.intro.statProfiles },
  ]

  return (
    <div className="flex min-h-[100svh] w-full items-center justify-center px-6 py-16">
      <div className="animate-fade-slide-up flex w-full max-w-xl flex-col items-center text-center">
        <p className="mb-10 font-mono text-xs uppercase tracking-[0.22em] text-teal">
          {t.intro.eyebrow}
        </p>

        <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight text-text sm:text-[3.25rem]">
          {t.intro.title}
        </h1>

        <p className="mt-6 max-w-md text-lg leading-relaxed text-muted">{t.intro.subtitle}</p>

        <div className="mt-14 grid w-full max-w-lg grid-cols-3 gap-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="flex flex-col items-center rounded-2xl border border-border bg-surface px-2 py-6 shadow-soft"
            >
              <span className="font-mono text-2xl font-medium text-text tnum">{s.value}</span>
              <span className="mt-2 text-sm text-muted">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Optional label so the advisor can identify this session later. */}
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && start()}
          placeholder={t.intro.namePlaceholder}
          aria-label={t.intro.namePlaceholder}
          maxLength={60}
          className="mt-12 w-full max-w-sm rounded-2xl border border-border bg-surface px-5 py-3.5 text-center text-base text-text shadow-soft outline-none transition-shadow placeholder:text-muted/70 focus:shadow-card focus:ring-2 focus:ring-teal/40"
        />

        <button
          type="button"
          onClick={start}
          className="mt-4 w-full max-w-sm rounded-2xl bg-teal py-4 text-base font-semibold text-white shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card active:translate-y-0"
        >
          {t.intro.start}
        </button>

        <p className="mt-6 text-sm text-muted">{t.intro.footnote}</p>

        <div className="mt-10 flex items-center gap-2 text-xs text-muted/70">
          <Link to="/advisor" className="transition-colors hover:text-muted">
            {t.intro.advisorAccess}
          </Link>
          <span aria-hidden>·</span>
          <Link to="/admin" className="transition-colors hover:text-muted">
            {t.intro.adminAccess}
          </Link>
        </div>
      </div>
    </div>
  )
}
