import { ARCHETYPES } from '../data/archetypes'
import type { DashboardData } from '../lib/scoring'
import {
  getSigmaLabel,
  getAlphaLabel,
  getLambdaLabel,
  getAmbigLabel,
  getLiqLabel,
  getTalkingPoints,
  splitLabel,
} from '../lib/advisorCopy'
import DimensionScoreBar from './DimensionScoreBar'

type Props = {
  data: DashboardData
}

const LEVELS = ['low', 'moderate', 'high'] as const

function levelOf(v: number): (typeof LEVELS)[number] {
  if (v < 0.3) return 'low'
  if (v < 0.6) return 'moderate'
  return 'high'
}

function AccessoryScore({ title, value, label }: { title: string; value: number; label: string }) {
  const active = levelOf(value)
  const { implication } = splitLabel(label)
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-text">{title}</span>
        <span className="font-mono text-xs text-muted tnum">{value.toFixed(2)}</span>
      </div>
      <div className="flex gap-1.5">
        {LEVELS.map((lvl) => {
          const on = lvl === active
          return (
            <div
              key={lvl}
              className={`flex-1 rounded-md py-1 text-center text-[11px] font-medium capitalize transition-colors ${
                on ? 'bg-teal/15 text-teal' : 'bg-surface2 text-muted'
              }`}
            >
              {lvl}
            </div>
          )
        })}
      </div>
      <p className="mt-2 text-xs text-muted">{implication}</p>
    </div>
  )
}

export default function AdvisorPanel({ data }: Props) {
  const { scores } = data

  const dimensions = [
    { label: 'Variance tolerance', value: scores.sigma, interp: getSigmaLabel(scores.sigma) },
    { label: 'Skew preference', value: scores.alpha, interp: getAlphaLabel(scores.alpha) },
    { label: 'Loss resilience', value: scores.lambda, interp: getLambdaLabel(scores.lambda) },
    { label: 'Ambiguity aversion', value: scores.ambig, interp: getAmbigLabel(scores.ambig) },
    { label: 'Liquidity tolerance', value: scores.liq, interp: getLiqLabel(scores.liq) },
  ]

  const matchStrength = Math.round(data.primarySimilarity * 100)
  const secondaryStrength =
    data.secondarySimilarity !== null ? Math.round(data.secondarySimilarity * 100) : null

  const lowSignals: string[] = []
  if (Math.abs(scores.sigma) < 0.2) lowSignals.push('variance tolerance')
  if (Math.abs(scores.alpha) < 0.2) lowSignals.push('skew preference')
  if (Math.abs(scores.lambda) < 0.2) lowSignals.push('loss aversion')

  const talkingPoints = getTalkingPoints(data.archetype, scores)

  const sectionLabel = 'font-mono text-xs uppercase tracking-[0.14em] text-muted'

  return (
    <div className="flex flex-col gap-8 p-8 min-[900px]:p-10">
      {/* Advisor view marker */}
      <div className="flex items-center gap-3">
        <span className="rounded-md bg-text px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.16em] text-bg">
          Advisor view
        </span>
        <span className="text-xs text-muted">Internal — not shown to the client</span>
      </div>

      {/* Raw dimension scores */}
      <section>
        <h3 className={`${sectionLabel} mb-4`}>Raw dimension scores</h3>
        <div className="space-y-5">
          {dimensions.map((d) => (
            <DimensionScoreBar key={d.label} label={d.label} value={d.value} interpretation={d.interp} />
          ))}
        </div>
      </section>

      {/* Classification confidence */}
      <section className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
        <h3 className={`${sectionLabel} mb-3`}>Classification confidence</h3>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-3xl font-medium text-text tnum">{matchStrength}%</span>
          <span className="text-sm text-muted">
            match — {ARCHETYPES[data.archetype].name}
          </span>
        </div>
        {data.isBlend && secondaryStrength !== null && data.secondaryArchetype && (
          <p className="mt-1.5 text-sm text-muted">
            Blend — secondary {ARCHETYPES[data.secondaryArchetype].name} at{' '}
            <span className="font-mono text-text tnum">{secondaryStrength}%</span>
          </p>
        )}
        {lowSignals.length > 0 && (
          <div className="mt-4 space-y-2">
            {lowSignals.map((dim) => (
              <p
                key={dim}
                className="rounded-lg bg-amber/[0.1] px-3 py-2 text-xs leading-snug text-amber"
              >
                Low signal on {dim} — follow up in conversation
              </p>
            ))}
          </div>
        )}
      </section>

      {/* Accessory scores */}
      <section>
        <h3 className={`${sectionLabel} mb-4`}>Accessory scores</h3>
        <div className="space-y-5">
          <AccessoryScore
            title="Ambiguity aversion"
            value={scores.ambig}
            label={getAmbigLabel(scores.ambig)}
          />
          <AccessoryScore
            title="Liquidity tolerance"
            value={scores.liq}
            label={getLiqLabel(scores.liq)}
          />
        </div>
      </section>

      {/* Talking points */}
      <section>
        <h3 className={`${sectionLabel} mb-4`}>Advisor talking points</h3>
        <ul className="space-y-3">
          {talkingPoints.map((point, i) => (
            <li key={i} className="flex items-start gap-3 text-sm leading-relaxed text-text">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal" />
              <span>{point}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
