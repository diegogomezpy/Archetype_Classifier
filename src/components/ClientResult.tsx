import { useLang, useT } from '../i18n/i18n'
import { localizedBand, bandColor } from '../i18n/content'
import type { DashboardData } from '../lib/scoring'

type Props = {
  data: DashboardData
  onRetake: () => void
}

// The client's end screen: their risk band (level + name + description). The
// portfolio, instruments, and measures are advisor-facing and live exclusively
// on the #/advisor routes.
export default function ClientResult({ data, onRetake }: Props) {
  const t = useT()
  const { lang } = useLang()
  const band = localizedBand(data.level, lang)
  const color = bandColor(data.level)

  return (
    <div className="flex min-h-[100svh] w-full items-center justify-center px-6 py-16">
      <div className="animate-fade-slide-up flex w-full max-w-xl flex-col items-center text-center">
        <p className="mb-8 font-mono text-xs uppercase tracking-[0.22em] text-teal">
          {t.result.eyebrow}
        </p>

        <span
          className="mb-5 inline-flex items-center gap-2 rounded-full border px-3.5 py-1 font-mono text-xs font-medium uppercase tracking-wider"
          style={{ borderColor: `${color}66`, color, backgroundColor: `${color}14` }}
        >
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
          {t.result.level(data.level)}
        </span>

        <h1 className="text-4xl font-semibold leading-tight tracking-tight text-text sm:text-[3rem]">
          {band.name}
        </h1>

        <p className="mt-6 max-w-md text-lg leading-relaxed text-muted">{band.desc}</p>

        <div className="mt-7 flex flex-wrap justify-center gap-2.5">
          {band.traits.map((trait) => (
            <span
              key={trait}
              className="rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm text-text shadow-soft"
            >
              {trait}
            </span>
          ))}
        </div>

        <p className="mt-10 max-w-sm text-sm leading-relaxed text-muted">{t.result.advisorNote}</p>

        <button
          type="button"
          onClick={onRetake}
          className="mt-8 w-full max-w-sm rounded-2xl border border-border bg-surface py-3.5 text-sm font-medium text-muted shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:text-text hover:shadow-card"
        >
          {t.result.retake}
        </button>
      </div>
    </div>
  )
}
