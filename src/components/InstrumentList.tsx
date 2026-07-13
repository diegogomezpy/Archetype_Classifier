import { useState } from 'react'
import { colorForCategory } from '../lib/instruments'
import { fieldSpecsFor, localQuickFacts, type ManagedInstrument } from '../lib/catalog'
import { useLang, useT } from '../i18n/i18n'

type Props = {
  instruments: (ManagedInstrument & { fit: number })[]
}

// Ranked fit list with per-instrument drill-down: clicking a row expands the
// asset's detail panel (admin-curated fields from ASSET_FIELD_SPECS, plus the
// risk vector and liquidity terms). House picks carry a badge.
export default function InstrumentList({ instruments }: Props) {
  const t = useT()
  const { lang } = useLang()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <ul className="divide-y divide-border">
      {instruments.map((inst, i) => {
        const region = inst.region ?? 'global'
        const color = colorForCategory(inst.assetClass, region)
        const expanded = expandedId === inst.id
        const specs = fieldSpecsFor(region, inst.assetClass)
        const description = inst.details.description
        const filled = specs.filter(
          (s) => s.key !== 'description' && (inst.details[s.key] ?? '').trim() !== '',
        )
        // Compact facts line (local instruments): distinguishes same-issuer bond
        // series and surfaces yield/rating/currency/maturity at a glance.
        const facts = localQuickFacts(inst, {
          common: t.admin.shareCommon,
          preferred: t.admin.sharePreferred,
          yrs: t.admin.yrsShort,
        })
        return (
          <li key={inst.id}>
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setExpandedId(expanded ? null : inst.id)}
              className="flex w-full items-center gap-4 py-3 text-left transition-colors hover:bg-surface2/40"
            >
              <span className="w-5 shrink-0 text-right font-mono text-sm text-muted tnum">
                {i + 1}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-text">{inst.name}</span>
                  {inst.emphasized && (
                    <span className="shrink-0 rounded-md bg-teal/12 px-2 py-0.5 text-[11px] font-medium text-teal">
                      {t.instrumentDetail.housePick}
                    </span>
                  )}
                </div>
                {facts && (
                  <p className="mt-0.5 truncate font-mono text-[11px] text-muted tnum">{facts}</p>
                )}
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface2">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${inst.fit}%`, backgroundColor: color }}
                  />
                </div>
              </div>

              <div className="flex w-16 shrink-0 flex-col items-end">
                <span className="font-mono text-xs text-muted">{inst.ticker}</span>
                <span className="font-mono text-sm font-medium text-text tnum">{inst.fit}</span>
              </div>
              <span
                aria-hidden
                className={`shrink-0 text-xs text-muted transition-transform duration-200 ${
                  expanded ? 'rotate-90' : ''
                }`}
              >
                ›
              </span>
            </button>

            {/* Detail panel — admin-curated per-class fields */}
            {expanded && (
              <div className="mb-3 ml-9 rounded-xl border border-border bg-surface2/30 p-4">
                {description && (
                  <p className="text-sm leading-relaxed text-text">{description}</p>
                )}
                {filled.length > 0 ? (
                  <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
                    {filled.map((s) => (
                      <div key={s.key} className="flex items-baseline justify-between gap-3">
                        <dt className="text-xs text-muted">{lang === 'es' ? s.es : s.en}</dt>
                        <dd className="text-right font-mono text-xs font-medium text-text tnum">
                          {inst.details[s.key]}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  !description && (
                    <p className="text-xs italic text-muted">{t.instrumentDetail.noDetails}</p>
                  )
                )}
                {/* Structural facts — always available */}
                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 border-t border-border/70 pt-3">
                  <span className="text-xs text-muted">
                    {t.instrumentDetail.riskVector}:{' '}
                    <span className="font-mono text-text">
                      σ {inst.sigmaLoad >= 0 ? '+' : ''}
                      {inst.sigmaLoad.toFixed(2)} · α {inst.alphaLoad >= 0 ? '+' : ''}
                      {inst.alphaLoad.toFixed(2)} · λ {inst.lambdaLoad >= 0 ? '+' : ''}
                      {inst.lambdaLoad.toFixed(2)}
                    </span>
                  </span>
                  <span className="text-xs text-muted">
                    {t.instrumentDetail.liquidityTier}:{' '}
                    <span className="font-mono text-text">{inst.liquidityTier}</span>
                  </span>
                  <span className="text-xs text-muted">
                    {t.instrumentDetail.lockup}:{' '}
                    <span className="font-mono text-text">
                      {inst.lockupMonths > 0
                        ? `${inst.lockupMonths} ${t.instrumentDetail.months}`
                        : t.instrumentDetail.tradeable}
                    </span>
                  </span>
                </div>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
