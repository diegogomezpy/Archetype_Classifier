import { computeAllocation, type DashboardData } from '../lib/scoring'
import { ASSET_CLASS_COLORS } from '../lib/instruments'
import { useArchetypeConfig } from '../lib/archetypeConfig'
import { useLang, useT } from '../i18n/i18n'
import { assetClassLabel, localizedArchetype } from '../i18n/content'
import DonutChart from './DonutChart'
import InstrumentTabs from './InstrumentTabs'

type Props = {
  data: DashboardData
  clientName: string | null
}

// Advisor-facing left panel of the session dashboard: who the client is, their
// classification, and what to recommend (allocation + instruments). Framed for
// the ADVISOR — the only client-voiced text is the archetype description, kept
// small and explicitly labeled as what the client was shown.
export default function RecommendationsPanel({ data, clientName }: Props) {
  const t = useT()
  const { lang } = useLang()
  const { config } = useArchetypeConfig()
  const archetype = localizedArchetype(data.archetype, lang)
  const secondary = data.secondaryArchetype
    ? localizedArchetype(data.secondaryArchetype, lang)
    : null

  // The recommended asset mix is the admin-curated model portfolio for this
  // archetype. The Quant's EV-driven book applies whenever the Quant is part of
  // the result — primary or additive overlay (e.g. Banker + Quant). If a mix is
  // somehow empty, fall back to the live engine so the dashboard never blanks.
  const allocArchetype =
    data.archetype === 'quant' || data.secondaryArchetype === 'quant' ? 'quant' : data.archetype
  const configured = config.assetMix[allocArchetype]
  const allocation =
    configured && configured.length > 0 ? configured : computeAllocation(allocArchetype, data.scores)

  return (
    <div className="flex flex-col gap-10 p-8 min-[900px]:p-10">
      {/* Client + classification header */}
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-teal">
          {t.dashboard.clientLabel}
        </p>
        <h1 className="mt-3 text-4xl font-semibold leading-tight tracking-tight text-text sm:text-[2.75rem]">
          {clientName || t.dashboard.unnamed}
        </h1>
        {/* Archetype + blend — the classification, not client marketing. */}
        <p className="mt-3 text-lg font-medium text-text">
          {archetype.name}
          {data.isBlend && secondary && (
            <span className="text-muted">
              {' · '}
              {t.dashboard.secondary} <span className="text-amber">{secondary.name}</span>
            </span>
          )}
        </p>
        {/* The client-voiced description, kept small and clearly labeled. */}
        <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
          {t.dashboard.shownToClient}
        </p>
        <p className="mt-1.5 max-w-xl text-sm italic leading-relaxed text-muted">
          “{archetype.desc}”
        </p>
      </header>

      {/* Suggested allocation */}
      <section>
        <h2 className="mb-5 font-mono text-xs uppercase tracking-[0.14em] text-muted">
          {t.dashboard.allocation}
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
                <span className="flex-1 text-sm text-text">
                  {assetClassLabel(a.assetClass, lang)}
                </span>
                <span className="font-mono text-sm font-medium text-text tnum">{a.pct}%</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Recommended instruments — per asset-class tabs with detail drill-down */}
      <section>
        <h2 className="mb-5 font-mono text-xs uppercase tracking-[0.14em] text-muted">
          {t.dashboard.instruments}
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
          {t.dashboard.downloadReport}
        </button>
      </div>
    </div>
  )
}
