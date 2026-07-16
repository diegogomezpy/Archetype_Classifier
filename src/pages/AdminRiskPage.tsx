import { useEffect, useState } from 'react'
import {
  ASSET_CLASSES,
  LOCAL_CATEGORIES,
  type AssetClass,
  type LocalCategory,
} from '../lib/instruments'
import { useRiskParams } from '../lib/riskParamsConfig'
import type { RiskParams } from '../lib/riskDerivation'
import { useLang, useT } from '../i18n/i18n'
import { assetClassLabel, categoryLabel } from '../i18n/content'
import AppNav from '../components/AppNav'
import AdminNav from '../components/AdminNav'

type Axis = 's' | 'a' | 'l'
const AXES: Axis[] = ['s', 'a', 'l']
const AXIS_LABEL: Record<Axis, string> = { s: 'σ', a: 'α', l: 'λ' }

const clone = (p: RiskParams): RiskParams => JSON.parse(JSON.stringify(p))
const parseNum = (v: string, d = 0) => {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : d
}
const numInput =
  'w-16 rounded-lg border border-border bg-surface px-2 py-1.5 text-right text-sm text-text tnum shadow-soft outline-none focus:ring-2 focus:ring-teal/40'
const sectionLabel = 'font-mono text-xs uppercase tracking-[0.14em] text-muted'

// Small σ/α/λ triple editor.
function VecRow({
  label,
  vec,
  onChange,
}: {
  label: string
  vec: { s: number; a: number; l: number }
  onChange: (axis: Axis, value: string) => void
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="min-w-0 flex-1 truncate text-sm text-text">{label}</span>
      {AXES.map((ax) => (
        <label key={ax} className="flex items-center gap-1">
          <span className="font-mono text-xs text-muted">{AXIS_LABEL[ax]}</span>
          <input
            type="number"
            step={0.05}
            className={numInput}
            value={vec[ax]}
            onChange={(e) => onChange(ax, e.target.value)}
          />
        </label>
      ))}
    </div>
  )
}

export default function AdminRiskPage() {
  const t = useT()
  const { lang } = useLang()
  const { params, setParams, reset } = useRiskParams()
  const [draft, setDraft] = useState<RiskParams>(() => clone(params))
  const [saved, setSaved] = useState(false)

  useEffect(() => setDraft(clone(params)), [params])

  const setGlobal = (cls: AssetClass, ax: Axis, v: string) =>
    setDraft((d) => ({ ...d, global: { ...d.global, [cls]: { ...d.global[cls], [ax]: parseNum(v) } } }))
  const setLocalBase = (cat: LocalCategory, ax: Axis, v: string) =>
    setDraft((d) => ({
      ...d,
      local: { ...d.local, [cat]: { ...d.local[cat], base: { ...d.local[cat].base, [ax]: parseNum(v) } } },
    }))
  const setLocalByRating = (cat: LocalCategory, ax: Axis, v: string) =>
    setDraft((d) => ({
      ...d,
      local: {
        ...d.local,
        [cat]: { ...d.local[cat], byRating: { ...d.local[cat].byRating, [ax]: parseNum(v) } },
      },
    }))
  const setRating = (r: string, v: string) =>
    setDraft((d) => ({ ...d, ratingRisk: { ...d.ratingRisk, [r]: parseNum(v) } }))

  const save = () => {
    setParams(draft)
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1500)
  }
  const handleReset = () => {
    if (window.confirm(t.adminRisk.resetConfirm)) reset()
  }

  const ratingKeys = Object.keys(draft.ratingRisk)

  return (
    <div>
      <AppNav />
      <div className="mx-auto w-full max-w-4xl px-6 py-8">
        <AdminNav />

        <div className="mt-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-text">{t.adminRisk.title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{t.adminRisk.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="shrink-0 rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm text-muted transition-colors hover:text-red"
          >
            {t.adminRisk.reset}
          </button>
        </div>

        {/* How it works */}
        <div className="mt-6 rounded-2xl border border-border bg-surface px-4 py-3 text-xs leading-relaxed text-muted shadow-soft">
          {t.adminRisk.howBody}
        </div>

        {/* Global base vectors */}
        <section className="mt-10">
          <h2 className={sectionLabel}>{t.adminRisk.globalTitle}</h2>
          <div className="mt-4 space-y-2.5 rounded-2xl border border-border bg-surface p-5 shadow-soft">
            {ASSET_CLASSES.map((cls) => (
              <VecRow
                key={cls}
                label={assetClassLabel(cls, lang)}
                vec={draft.global[cls]}
                onChange={(ax, v) => setGlobal(cls, ax, v)}
              />
            ))}
            <div className="flex items-center gap-3 border-t border-border/70 pt-3">
              <span className="min-w-0 flex-1 text-sm text-text">{t.adminRisk.betaSensitivity}</span>
              <input
                type="number"
                step={0.05}
                className={numInput}
                value={draft.equityBetaSensitivity}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, equityBetaSensitivity: parseNum(e.target.value) }))
                }
              />
            </div>
          </div>
        </section>

        {/* Local base + rating sensitivity */}
        <section className="mt-10">
          <h2 className={sectionLabel}>{t.adminRisk.localTitle}</h2>
          <div className="mt-4 space-y-4">
            {LOCAL_CATEGORIES.map((cat) => (
              <div key={cat} className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
                <h3 className="mb-3 text-sm font-semibold text-text">
                  {categoryLabel(cat, 'local', lang)}
                </h3>
                <div className="space-y-2.5">
                  <VecRow
                    label={t.adminRisk.base}
                    vec={draft.local[cat].base}
                    onChange={(ax, v) => setLocalBase(cat, ax, v)}
                  />
                  <VecRow
                    label={t.adminRisk.byRating}
                    vec={draft.local[cat].byRating}
                    onChange={(ax, v) => setLocalByRating(cat, ax, v)}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Rating → risk factor */}
        <section className="mt-10">
          <h2 className={sectionLabel}>{t.adminRisk.ratingTitle}</h2>
          <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2 rounded-2xl border border-border bg-surface p-5 shadow-soft sm:grid-cols-3">
            {ratingKeys.map((r) => (
              <label key={r} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 font-mono text-xs text-muted">{r}</span>
                <input
                  type="number"
                  step={0.05}
                  min={0}
                  max={1}
                  className={numInput}
                  value={draft.ratingRisk[r]}
                  onChange={(e) => setRating(r, e.target.value)}
                />
              </label>
            ))}
          </div>
        </section>

        <div className="mt-8 flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            className="rounded-xl bg-teal px-6 py-2.5 text-sm font-semibold text-white shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card"
          >
            {t.adminRisk.save}
          </button>
          {saved && <span className="text-sm font-medium text-teal">{t.adminRisk.saved}</span>}
        </div>
      </div>
    </div>
  )
}
