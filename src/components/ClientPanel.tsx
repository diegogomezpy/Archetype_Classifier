import { useMemo } from 'react'
import { ARCHETYPES } from '../data/archetypes'
import { computeAllocation, type DashboardData } from '../lib/scoring'
import { ASSET_CLASS_COLORS } from '../lib/instruments'
import DonutChart from './DonutChart'
import InstrumentTabs from './InstrumentTabs'

type Props = {
  data: DashboardData
  totalPnl: number
  onRetake: () => void
}

export default function ClientPanel({ data, totalPnl, onRetake }: Props) {
  const archetype = ARCHETYPES[data.archetype]
  const secondary = data.secondaryArchetype ? ARCHETYPES[data.secondaryArchetype] : null

  // The Quant's EV-driven 90/10 book applies whenever the Quant is part of the
  // result — as the primary profile or as the additive overlay (e.g. Banker +
  // Quant) — so the allocation reflects the EV discipline either way.
  const allocArchetype =
    data.archetype === 'quant' || data.secondaryArchetype === 'quant' ? 'quant' : data.archetype
  const allocation = useMemo(
    () => computeAllocation(allocArchetype, data.scores),
    [allocArchetype, data.scores],
  )
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
        {data.tentative && (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-amber/40 bg-amber/[0.07] px-3 py-1 text-xs font-medium text-amber">
            <span aria-hidden>≈</span>
            Tentative read — your choices didn't lean strongly, so this is a best fit rather than a
            clear call
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

      {/* Game result — how the player's choices actually played out */}
      <section className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-mono text-xs uppercase tracking-[0.14em] text-muted">Your run</h2>
            <p className="mt-1 text-sm text-muted">How your choices played out across the game</p>
          </div>
          <span
            className={`font-mono text-2xl font-semibold tnum ${
              Math.round(totalPnl) === 0 ? 'text-muted' : totalPnl > 0 ? 'text-teal' : 'text-red'
            }`}
          >
            {Math.round(totalPnl) === 0
              ? '$0'
              : (totalPnl > 0 ? '+$' : '−$') +
                Math.abs(Math.round(totalPnl)).toLocaleString('en-US')}
          </span>
        </div>
      </section>

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

      {/* Recommended instruments — per asset-class tabs */}
      <section>
        <h2 className="mb-5 font-mono text-xs uppercase tracking-[0.14em] text-muted">
          Recommended instruments
        </h2>
        <InstrumentTabs allocation={allocation} scores={data.scores} />
      </section>

      {/* Actions — hidden from the printed report */}
      <div className="no-print flex w-full max-w-md flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => window.print()}
          className="flex-1 rounded-2xl bg-teal py-3.5 text-sm font-medium text-white shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card"
        >
          Download report (PDF)
        </button>
        <button
          type="button"
          onClick={onRetake}
          className="flex-1 rounded-2xl border border-border bg-surface py-3.5 text-sm font-medium text-muted shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:text-text hover:shadow-card"
        >
          Retake the assessment
        </button>
      </div>
    </div>
  )
}
