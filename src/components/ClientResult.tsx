import { useLang, useT } from '../i18n/i18n'
import { localizedArchetype } from '../i18n/content'
import type { DashboardData } from '../lib/scoring'

type Props = {
  data: DashboardData
  onRetake: () => void
}

// The client's end-of-game screen: ONLY the archetype and a brief description.
// Allocation, instruments, scores, and talking points are advisor-facing and
// live exclusively on the #/advisor routes.
export default function ClientResult({ data, onRetake }: Props) {
  const t = useT()
  const { lang } = useLang()
  const archetype = localizedArchetype(data.archetype, lang)
  const secondary =
    data.isBlend && data.secondaryArchetype
      ? localizedArchetype(data.secondaryArchetype, lang)
      : null

  return (
    <div className="flex min-h-[100svh] w-full items-center justify-center px-6 py-16">
      <div className="animate-fade-slide-up flex w-full max-w-xl flex-col items-center text-center">
        <p className="mb-8 font-mono text-xs uppercase tracking-[0.22em] text-teal">
          {t.result.eyebrow}
        </p>

        <h1 className="text-4xl font-semibold leading-tight tracking-tight text-text sm:text-[3rem]">
          {archetype.name}
        </h1>

        {secondary && (
          <p className="mt-3 text-sm text-muted">
            {t.result.secondaryLean}{' '}
            <span className="font-medium text-amber">{secondary.name}</span>
          </p>
        )}

        {data.tentative && (
          <p className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-amber/40 bg-amber/[0.07] px-3 py-1 text-xs font-medium text-amber">
            <span aria-hidden>≈</span>
            {t.result.tentative}
          </p>
        )}

        <p className="mt-6 max-w-md text-lg leading-relaxed text-muted">{archetype.desc}</p>

        <div className="mt-7 flex flex-wrap justify-center gap-2.5">
          {archetype.traits.map((trait) => (
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
