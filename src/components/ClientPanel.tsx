import { useMemo } from 'react'
import { ARCHETYPES } from '../data/archetypes'
import { computeAllocation, getRankedInstruments, type DashboardData } from '../lib/scoring'
import { ASSET_CLASS_COLORS } from '../lib/instruments'
import DonutChart from './DonutChart'
import InstrumentList from './InstrumentList'

type Props = {
  data: DashboardData
  onRetake: () => void
}

export default function ClientPanel({ data, onRetake }: Props) {
  const archetype = ARCHETYPES[data.archetype]
  const secondary = data.secondaryArchetype ? ARCHETYPES[data.secondaryArchetype] : null

  const allocation = useMemo(
    () => computeAllocation(data.archetype, data.scores),
    [data.archetype, data.scores],
  )
  const instruments = useMemo(() => getRankedInstruments(data.scores), [data.scores])

  return (
    <div className="flex flex-col gap-10 p-8 min-[900px]:p-10">
      {/* Archetype header */}
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-teal">Your investor profile</p>
        <h1 className="mt-3 text-4xl font-semibold leading-tight tracking-tight text-text sm:text-[2.75rem]">
          {archetype.name}
        </h1>
        {data.isBlend && secondary && (
          <p className="mt-2.5 text-sm text-muted">
            Primary: <span className="font-medium text-text">{archetype.name}</span> · Secondary:{' '}
            <span className="font-medium text-amber">{secondary.name}</span>
          </p>
        )}
        <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">{archetype.desc}</p>
        <div className="mt-5 flex flex-wrap gap-2.5">
          {archetype.traits.map((t) => (
            <span
              key={t}
              className="rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm text-text shadow-soft"
            >
              {t}
            </span>
          ))}
        </div>
      </header>

      {/* Suggested allocation */}
      <section>
        <h2 className="mb-5 font-mono text-xs uppercase tracking-[0.14em] text-muted">
          Suggested allocation
        </h2>
        <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-center">
          <DonutChart data={allocation} size={196} />
          <ul className="flex-1 space-y-2.5">
            {allocation.map((a) => (
              <li key={a.assetClass} className="flex items-center gap-3">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: ASSET_CLASS_COLORS[a.assetClass] }}
                />
                <span className="flex-1 text-sm text-text">{a.assetClass}</span>
                <span className="font-mono text-sm font-medium text-text tnum">{a.pct}%</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Recommended instruments */}
      <section>
        <h2 className="mb-2 font-mono text-xs uppercase tracking-[0.14em] text-muted">
          Recommended instruments
        </h2>
        <InstrumentList instruments={instruments} />
      </section>

      {/* Retake */}
      <button
        type="button"
        onClick={onRetake}
        className="w-full max-w-xs rounded-2xl border border-border bg-surface py-3.5 text-sm font-medium text-muted shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:text-text hover:shadow-card"
      >
        Retake the assessment
      </button>
    </div>
  )
}
