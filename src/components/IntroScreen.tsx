import { useState } from 'react'
import { useT } from '../i18n/i18n'
import { useDirectory } from '../lib/directory'

export type StartInfo = { name: string; advisorId: string | null }

type Props = {
  onStart: (info: StartInfo) => void
}

export default function IntroScreen({ onStart }: Props) {
  const t = useT()
  const { advisors, lastClient } = useDirectory()

  // Prefill from the device-remembered client (if their advisor still exists).
  const rememberedAdvisor =
    lastClient && advisors.some((a) => a.id === lastClient.advisorId) ? lastClient : null
  const [name, setName] = useState(rememberedAdvisor?.name ?? '')
  const [advisorId, setAdvisorId] = useState<string>(rememberedAdvisor?.advisorId ?? '')

  const hasAdvisors = advisors.length > 0
  const ready = name.trim().length > 0 && (!hasAdvisors || advisorId !== '')

  const start = () => {
    if (!ready) return
    onStart({ name: name.trim(), advisorId: advisorId || null })
  }

  const startFresh = () => {
    setName('')
    setAdvisorId('')
  }

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

        {/* Client identity: name + advisor. */}
        <div className="mt-12 flex w-full max-w-sm flex-col gap-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && start()}
            placeholder={t.intro.namePlaceholder}
            aria-label={t.intro.namePlaceholder}
            maxLength={60}
            className="w-full rounded-2xl border border-border bg-surface px-5 py-3.5 text-center text-base text-text shadow-soft outline-none transition-shadow placeholder:text-muted/70 focus:shadow-card focus:ring-2 focus:ring-teal/40"
          />

          {hasAdvisors && (
            <select
              value={advisorId}
              onChange={(e) => setAdvisorId(e.target.value)}
              aria-label={t.intro.selectAdvisor}
              className={`w-full rounded-2xl border border-border bg-surface px-5 py-3.5 text-center text-base shadow-soft outline-none transition-shadow focus:shadow-card focus:ring-2 focus:ring-teal/40 ${
                advisorId ? 'text-text' : 'text-muted/70'
              }`}
            >
              <option value="" disabled>
                {t.intro.selectAdvisor}
              </option>
              {advisors.map((a) => (
                <option key={a.id} value={a.id} className="text-text">
                  {a.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {rememberedAdvisor && (
          <p className="mt-3 text-xs text-muted">
            {t.intro.welcomeBack(rememberedAdvisor.name)}{' '}
            <button
              type="button"
              onClick={startFresh}
              className="font-medium text-teal underline-offset-2 hover:underline"
            >
              {t.intro.startFresh}
            </button>
          </p>
        )}

        <button
          type="button"
          onClick={start}
          disabled={!ready}
          className="mt-4 w-full max-w-sm rounded-2xl bg-teal py-4 text-base font-semibold text-white shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t.intro.start}
        </button>

        <p className="mt-6 text-sm text-muted">{t.intro.footnote}</p>
      </div>
    </div>
  )
}
