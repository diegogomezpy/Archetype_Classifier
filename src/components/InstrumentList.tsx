import { useState } from 'react'
import { colorForCategory } from '../lib/instruments'
import { kindLabel, localQuickFacts, type ManagedInstrument } from '../lib/catalog'
import { useLang, useT } from '../i18n/i18n'
import InstrumentReport from './InstrumentReport'

type Props = {
  instruments: (ManagedInstrument & { fit: number })[]
}

// Ranked fit list: each row is a compact index entry (name, kind, fit bar,
// ticker/score). Selecting one opens its full report (InstrumentReport) in
// place of the list — a client-ready one-pager, not a cramped stat grid.
export default function InstrumentList({ instruments }: Props) {
  const t = useT()
  const { lang } = useLang()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = selectedId ? instruments.find((i) => i.id === selectedId) : null

  if (selected) {
    return (
      <InstrumentReport
        instrument={selected}
        region={selected.region ?? 'global'}
        onBack={() => setSelectedId(null)}
      />
    )
  }

  return (
    <ul className="max-h-[30rem] divide-y divide-border overflow-y-auto pr-1 print:max-h-none print:overflow-visible">
      {instruments.map((inst, i) => {
        const region = inst.region ?? 'global'
        const color = colorForCategory(inst.assetClass, region)
        const facts = localQuickFacts(inst, {
          common: t.admin.shareCommon,
          preferred: t.admin.sharePreferred,
          yrs: t.admin.yrsShort,
        })
        return (
          <li key={inst.id}>
            <button
              type="button"
              onClick={() => setSelectedId(inst.id)}
              className="flex w-full items-center gap-4 py-3 text-left transition-colors hover:bg-surface2/40"
            >
              <span className="w-5 shrink-0 text-right font-mono text-sm text-muted tnum">
                {i + 1}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-text">{inst.name}</span>
                  {inst.kind && (
                    <span className="shrink-0 rounded-md bg-surface2 px-1.5 py-0.5 text-[10px] font-medium text-muted">
                      {kindLabel(inst.kind, lang, inst.region ?? 'global', inst.assetClass)}
                    </span>
                  )}
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
                {inst.ticker && <span className="font-mono text-xs text-muted">{inst.ticker}</span>}
                <span className="font-mono text-sm font-medium text-text tnum">{inst.fit}</span>
              </div>
              <span aria-hidden className="shrink-0 text-xs text-muted">
                ›
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
