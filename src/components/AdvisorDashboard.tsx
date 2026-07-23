import { useState } from 'react'
import { computeAllocation, type DashboardData } from '../lib/scoring'
import { colorForCategory, type Category, type Region } from '../lib/instruments'
import { useArchetypeConfig } from '../lib/archetypeConfig'
import { useLang, useT } from '../i18n/i18n'
import { categoryLabel, localizedArchetype, regionLabel } from '../i18n/content'
import DonutChart from './DonutChart'
import InstrumentTabs from './InstrumentTabs'
import DimensionScoreBar from './DimensionScoreBar'

type Props = {
  data: DashboardData
  clientName: string | null
}

type Slice = { assetClass: Category; pct: number }

const sectionLabel = 'font-mono text-xs uppercase tracking-[0.16em] text-muted'

// One allocation card: donut + legend for a region's model portfolio.
function AllocationCard({
  title,
  region,
  allocation,
}: {
  title: string
  region: Region
  allocation: Slice[]
}) {
  const t = useT()
  const { lang } = useLang()
  return (
    <div className="print-avoid-break rounded-2xl border border-border bg-surface p-6 shadow-soft">
      <p className="mb-5 text-sm font-semibold text-text">{title}</p>
      {allocation.length === 0 ? (
        <p className="text-sm text-muted">{t.dashboard.localNone}</p>
      ) : (
        <div className="flex flex-col items-center gap-6 min-[420px]:flex-row min-[420px]:items-center">
          <DonutChart data={allocation} size={150} region={region} />
          <ul className="flex-1 space-y-2">
            {allocation.map((a) => (
              <li key={a.assetClass} className="flex items-center gap-2.5">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: colorForCategory(a.assetClass, region) }}
                />
                <span className="flex-1 truncate text-sm text-text">
                  {categoryLabel(a.assetClass, region, lang)}
                </span>
                <span className="font-mono text-sm font-medium text-text tnum">{a.pct}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// The advisor's review of one client session, as a full-width top-to-bottom
// report: identity + confidence, risk profile, the two model portfolios
// (global + local) side by side, the recommended instruments, and talking
// points. Strictly advisor-facing — rendered only on #/advisor/session/:id.
export default function AdvisorDashboard({ data, clientName }: Props) {
  const t = useT()
  const { lang } = useLang()
  const { config } = useArchetypeConfig()
  const [instRegion, setInstRegion] = useState<Region>('global')

  const archetype = localizedArchetype(data.archetype, lang)
  const secondary = data.secondaryArchetype
    ? localizedArchetype(data.secondaryArchetype, lang)
    : null

  // Model portfolios for this archetype (Quant's EV book applies whenever the
  // Quant is in the result). Global falls back to the live engine if unset.
  const allocArchetype =
    data.archetype === 'quant' || data.secondaryArchetype === 'quant' ? 'quant' : data.archetype
  const gc = config.assetMix[allocArchetype]
  const globalAllocation: Slice[] =
    gc && gc.length > 0 ? gc : computeAllocation(allocArchetype, data.scores)
  const localAllocation: Slice[] = config.localAssetMix[allocArchetype] ?? []

  // Risk dimensions. Loss is shown as TOLERANCE (−λ) so all axes share polarity
  // (teal/right = risk-on, amber/left = risk-off).
  const { scores } = data
  const dimensions = [
    { label: t.advisorPanel.dimVariance, value: scores.sigma },
    { label: t.advisorPanel.dimSkew, value: scores.alpha },
    { label: t.advisorPanel.dimLoss, value: -scores.lambda },
    { label: t.advisorPanel.dimEv, value: scores.ev },
  ]
  const confidencePct = Math.round(data.confidence * 100)

  const lowSignals: string[] = []
  if (Math.abs(scores.sigma) < 0.2) lowSignals.push(t.advisorPanel.dimVariance)
  if (Math.abs(scores.alpha) < 0.2) lowSignals.push(t.advisorPanel.dimSkew)
  if (Math.abs(scores.lambda) < 0.2) lowSignals.push(t.advisorPanel.dimLoss)
  if (Math.abs(scores.ev) < 0.2) lowSignals.push(t.advisorPanel.dimEv)

  return (
    <div className="animate-fade-300 mx-auto w-full max-w-5xl px-6 pb-16 pt-6 min-[900px]:px-8">
      {/* Advisor-view marker */}
      <div className="no-print mb-5">
        <span className="rounded-md bg-text px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.16em] text-bg">
          {t.common.advisorView}
        </span>
      </div>

      {/* ── Hero: client, archetype, confidence ─────────────────────────────── */}
      <header className="print-avoid-break rounded-3xl border border-border bg-surface p-8 shadow-soft">
        <div className="flex flex-col gap-6 min-[720px]:flex-row min-[720px]:items-start min-[720px]:justify-between">
          <div className="min-w-0">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-teal">
              {t.dashboard.clientLabel}
            </p>
            <h1 className="mt-2 text-4xl font-semibold leading-tight tracking-tight text-text">
              {clientName || t.dashboard.unnamed}
            </h1>
            <p className="mt-2 text-lg font-medium text-text">
              {archetype.name}
              {data.isBlend && secondary && (
                <span className="text-muted">
                  {' · '}
                  {t.dashboard.secondary} <span className="text-amber">{secondary.name}</span>
                </span>
              )}
            </p>
          </div>
          <div
            className={`shrink-0 self-start rounded-2xl border px-6 py-4 text-center ${
              data.tentative ? 'border-amber/40 bg-amber/[0.06]' : 'border-teal/30 bg-teal/[0.06]'
            }`}
          >
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
              {t.advisorPanel.confidenceTitle}
            </p>
            <p
              className={`mt-1 font-mono text-3xl font-medium tnum ${
                data.tentative ? 'text-amber' : 'text-teal'
              }`}
            >
              {confidencePct}%
            </p>
          </div>
        </div>
      </header>

      {/* ── Risk profile ────────────────────────────────────────────────────── */}
      <section className="mt-10">
        <h2 className={sectionLabel}>{t.advisorPanel.rawScores}</h2>
        <div className="mt-5 grid grid-cols-1 gap-x-12 gap-y-5 sm:grid-cols-2">
          {dimensions.map((d) => (
            <DimensionScoreBar key={d.label} label={d.label} value={d.value} />
          ))}
        </div>
        {lowSignals.length > 0 && (
          <p className="mt-5 text-xs text-amber">
            {t.advisorPanel.lowSignalBrief(lowSignals.join(', '))}
          </p>
        )}
      </section>

      {/* ── Recommended allocation — global + local side by side ────────────── */}
      <section className="mt-12">
        <h2 className={sectionLabel}>{t.dashboard.allocation}</h2>
        <div className="mt-5 grid grid-cols-1 gap-4 min-[720px]:grid-cols-2">
          <AllocationCard title={t.dashboard.portfolioGlobal} region="global" allocation={globalAllocation} />
          <AllocationCard title={t.dashboard.portfolioLocal} region="local" allocation={localAllocation} />
        </div>
      </section>

      {/* ── Recommended instruments — region toggle (both on print) ─────────── */}
      <section className="mt-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className={sectionLabel}>{t.dashboard.instruments}</h2>
          <div className="no-print inline-flex rounded-full border border-border bg-surface p-0.5">
            {(['global', 'local'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setInstRegion(r)}
                className={`rounded-full px-4 py-1 text-xs font-medium transition-all ${
                  instRegion === r ? 'bg-teal/15 text-teal shadow-soft' : 'text-muted hover:text-text'
                }`}
              >
                {regionLabel(r, lang)}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-5 rounded-2xl border border-border bg-surface p-6 shadow-soft">
          <div className={`${instRegion === 'global' ? 'block' : 'hidden'} print:block`}>
            <p className="mb-4 hidden text-sm font-semibold text-text print:block">
              {t.dashboard.portfolioGlobal}
            </p>
            <InstrumentTabs allocation={globalAllocation} scores={data.scores} region="global" />
          </div>
          <div className={`${instRegion === 'local' ? 'block' : 'hidden'} print:mt-8 print:block`}>
            <p className="mb-4 hidden text-sm font-semibold text-text print:block">
              {t.dashboard.portfolioLocal}
            </p>
            {localAllocation.length === 0 ? (
              <p className="text-sm text-muted">{t.dashboard.localNone}</p>
            ) : (
              <InstrumentTabs allocation={localAllocation} scores={data.scores} region="local" />
            )}
          </div>
        </div>
      </section>

    </div>
  )
}
