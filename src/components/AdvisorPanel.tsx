import type { DashboardData } from '../lib/scoring'
import {
  getSigmaLabel,
  getAlphaLabel,
  getLossToleranceLabel,
  getEvLabel,
  getTalkingPoints,
} from '../lib/advisorCopy'
import { useLang, useT } from '../i18n/i18n'
import { localizedArchetype } from '../i18n/content'
import DimensionScoreBar from './DimensionScoreBar'

type Props = {
  data: DashboardData
}

export default function AdvisorPanel({ data }: Props) {
  const t = useT()
  const { lang } = useLang()
  const { scores } = data

  // Loss is shown as TOLERANCE (= −λ) so polarity matches the other risk axes:
  // teal/right = risk-on, amber/left = risk-off, consistently across all three.
  const lossTolerance = -scores.lambda
  const dimensions = [
    {
      label: t.advisorPanel.dimVariance,
      value: scores.sigma,
      interp: getSigmaLabel(scores.sigma, lang),
    },
    {
      label: t.advisorPanel.dimSkew,
      value: scores.alpha,
      interp: getAlphaLabel(scores.alpha, lang),
    },
    {
      label: t.advisorPanel.dimLoss,
      value: lossTolerance,
      interp: getLossToleranceLabel(lossTolerance, lang),
    },
    { label: t.advisorPanel.dimEv, value: scores.ev, interp: getEvLabel(scores.ev, lang) },
  ]

  const confidencePct = Math.round(data.confidence * 100)
  const matchStrength = Math.round(data.primarySimilarity * 100)
  const secondaryStrength =
    data.secondarySimilarity !== null ? Math.round(data.secondarySimilarity * 100) : null
  // Cosine "shape-direction match" only means something for the shape archetypes;
  // the Indexer/Quant aren't placed by direction.
  const isShapePrimary = data.archetype !== 'indexer' && data.archetype !== 'quant'

  const lowSignals: string[] = []
  if (Math.abs(scores.sigma) < 0.2) lowSignals.push(t.advisorPanel.dimVariance)
  if (Math.abs(scores.alpha) < 0.2) lowSignals.push(t.advisorPanel.dimSkew)
  if (Math.abs(scores.lambda) < 0.2) lowSignals.push(t.advisorPanel.dimLoss)
  if (Math.abs(scores.ev) < 0.2) lowSignals.push(t.advisorPanel.dimEv)

  const talkingPoints = getTalkingPoints(data.archetype, scores, lang)

  const sectionLabel = 'font-mono text-xs uppercase tracking-[0.14em] text-muted'

  return (
    <div className="flex flex-col gap-8 p-8 min-[900px]:p-10">
      {/* Advisor view marker */}
      <div className="flex items-center gap-3">
        <span className="rounded-md bg-text px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.16em] text-bg">
          {t.common.advisorView}
        </span>
        <span className="text-xs text-muted">{t.advisorPanel.internal}</span>
      </div>

      {/* Raw dimension scores */}
      <section>
        <h3 className={`${sectionLabel} mb-4`}>{t.advisorPanel.rawScores}</h3>
        <div className="space-y-5">
          {dimensions.map((d) => (
            <DimensionScoreBar key={d.label} label={d.label} value={d.value} interpretation={d.interp} />
          ))}
        </div>
      </section>

      {/* Classification confidence */}
      <section className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
        <h3 className={`${sectionLabel} mb-3`}>{t.advisorPanel.confidenceTitle}</h3>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-3xl font-medium text-text tnum">{confidencePct}%</span>
          <span className="text-sm text-muted">
            {t.advisorPanel.confidenceSuffix(localizedArchetype(data.archetype, lang).name)}
          </span>
        </div>
        {isShapePrimary && (
          <p className="mt-1.5 text-sm text-muted">
            {t.advisorPanel.shapeMatch}{' '}
            <span className="font-mono text-text tnum">{matchStrength}%</span>
          </p>
        )}
        {data.isBlend && secondaryStrength !== null && data.secondaryArchetype && (
          <p className="mt-1.5 text-sm text-muted">
            {t.advisorPanel.blendLine(localizedArchetype(data.secondaryArchetype, lang).name)}{' '}
            <span className="font-mono text-text tnum">{secondaryStrength}%</span>
          </p>
        )}
        {data.tentative && (
          <p className="mt-3 rounded-lg bg-amber/[0.1] px-3 py-2 text-xs font-medium leading-snug text-amber">
            {t.advisorPanel.tentative}
          </p>
        )}
        {lowSignals.length > 0 && (
          <div className="mt-4 space-y-2">
            {lowSignals.map((dim) => (
              <p
                key={dim}
                className="rounded-lg bg-amber/[0.1] px-3 py-2 text-xs leading-snug text-amber"
              >
                {t.advisorPanel.lowSignal(dim)}
              </p>
            ))}
          </div>
        )}
      </section>

      {/* Talking points */}
      <section>
        <h3 className={`${sectionLabel} mb-4`}>{t.advisorPanel.talkingPoints}</h3>
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
