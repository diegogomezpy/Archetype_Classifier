import { useEffect, useState } from 'react'
import {
  ASSET_CLASSES,
  LOCAL_CATEGORIES,
  type AssetClass,
  type LocalCategory,
} from '../lib/instruments'
import { deriveRiskLevel, type RiskLevelParams } from '../lib/riskLevels'
import { useRiskLevels } from '../lib/riskLevelsConfig'
import type { RiskLevel } from '../lib/scoring'
import { useLang, useT } from '../i18n/i18n'
import { assetClassLabel, categoryLabel } from '../i18n/content'
import AppNav from '../components/AppNav'
import AdminNav from '../components/AdminNav'

const pick = (lang: 'en' | 'es', en: string, es: string) => (lang === 'es' ? es : en)
const clone = (p: RiskLevelParams): RiskLevelParams => JSON.parse(JSON.stringify(p))

const RATING_KEYS = [
  'AAA', 'AA+', 'AA', 'AA-', 'A+', 'A', 'A-',
  'BBB+', 'BBB', 'BBB-', 'BB+', 'BB', 'BB-', 'B+', 'B', 'B-', 'CCC', 'CC', 'C', 'D',
]

const selCls =
  'rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-text tnum shadow-soft outline-none focus:ring-2 focus:ring-teal/40'
const numCls = `${selCls} w-16 text-right`
const label = 'font-mono text-[10px] uppercase tracking-wider text-muted'
const LEVEL_COLORS: Record<RiskLevel, string> = {
  1: '#3FA97F', 2: '#8DBF5A', 3: '#E0B93C', 4: '#E08A3C', 5: '#E05C5C',
}

function LevelSelect({ value, onChange }: { value: RiskLevel; onChange: (v: RiskLevel) => void }) {
  return (
    <select className={`${selCls} w-16`} value={value} onChange={(e) => onChange(Number(e.target.value) as RiskLevel)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <option key={n} value={n}>
          {n}
        </option>
      ))}
    </select>
  )
}

function LevelChip({ level }: { level: RiskLevel }) {
  return (
    <span
      className="inline-flex h-6 w-6 items-center justify-center rounded-md font-mono text-xs font-semibold"
      style={{ backgroundColor: `${LEVEL_COLORS[level]}22`, color: LEVEL_COLORS[level] }}
    >
      {level}
    </span>
  )
}

export default function AdminRiskPage() {
  const t = useT()
  const { lang } = useLang()
  const { params, setParams, reset } = useRiskLevels()
  const [draft, setDraft] = useState<RiskLevelParams>(() => clone(params))
  useEffect(() => setDraft(clone(params)), [params])

  const setBase = (cls: AssetClass, v: RiskLevel) =>
    setDraft((d) => ({ ...d, baseLevel: { ...d.baseLevel, [cls]: v } }))
  const setLocalBase = (cat: LocalCategory, v: RiskLevel) =>
    setDraft((d) => ({ ...d, localBaseLevel: { ...d.localBaseLevel, [cat]: v } }))
  const setRating = (k: string, v: number) =>
    setDraft((d) => ({ ...d, ratingAdjust: { ...d.ratingAdjust, [k]: v } }))
  const setVol = (i: number, v: number) =>
    setDraft((d) => {
      const vt = d.volThresholds.slice()
      vt[i] = { ...vt[i], maxVol: v }
      return { ...d, volThresholds: vt }
    })

  // Live preview — recomputed from the draft as the admin edits.
  const examples: { label: string; level: RiskLevel }[] = [
    {
      label: pick(lang, 'Fixed income · AAA · short', 'Renta fija · AAA · corta'),
      level: deriveRiskLevel('global', 'Fixed income', 'AAA', 0.03, draft),
    },
    {
      label: pick(lang, 'Fixed income · BB · 5y', 'Renta fija · BB · 5a'),
      level: deriveRiskLevel('global', 'Fixed income', 'BB', 0.09, draft),
    },
    {
      label: pick(lang, 'Equity · vol 25%', 'Acción · vol 25%'),
      level: deriveRiskLevel('global', 'Equities', undefined, 0.25, draft),
    },
    {
      label: pick(lang, 'Investment fund (local)', 'Fondo de inversión (local)'),
      level: deriveRiskLevel('local', 'Investment funds', undefined, undefined, draft),
    },
  ]

  const dirty = JSON.stringify(draft) !== JSON.stringify(params)

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
            onClick={() => window.confirm(t.adminRisk.resetConfirm) && reset()}
            className="shrink-0 rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm text-muted transition-colors hover:text-red"
          >
            {t.adminRisk.reset}
          </button>
        </div>

        {/* Live preview */}
        <div className="mt-6 rounded-2xl border border-border bg-surface p-5 shadow-soft">
          <p className={label}>{pick(lang, 'Preview', 'Vista previa')}</p>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {examples.map((ex) => (
              <div key={ex.label} className="flex items-center gap-2.5">
                <LevelChip level={ex.level} />
                <span className="text-sm text-text">{ex.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Base level per class */}
        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
            <p className={label}>{pick(lang, 'Base level · global', 'Nivel base · global')}</p>
            <div className="mt-3 space-y-2.5">
              {ASSET_CLASSES.map((cls) => (
                <div key={cls} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-text">{assetClassLabel(cls, lang)}</span>
                  <LevelSelect value={draft.baseLevel[cls]} onChange={(v) => setBase(cls, v)} />
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
            <p className={label}>{pick(lang, 'Base level · local', 'Nivel base · local')}</p>
            <div className="mt-3 space-y-2.5">
              {LOCAL_CATEGORIES.map((cat) => (
                <div key={cat} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-text">{categoryLabel(cat, 'local', lang)}</span>
                  <LevelSelect value={draft.localBaseLevel[cat]} onChange={(v) => setLocalBase(cat, v)} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Rating adjustment */}
        <div className="mt-6 rounded-2xl border border-border bg-surface p-5 shadow-soft">
          <p className={label}>{pick(lang, 'Credit rating → level delta', 'Calificación → ajuste de nivel')}</p>
          <p className="mt-1 text-xs text-muted">
            {pick(
              lang,
              'How many levels a bond moves up (+) or down (−) from its base for each rating.',
              'Cuántos niveles sube (+) o baja (−) un bono desde su base según la calificación.',
            )}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
            {RATING_KEYS.map((k) => (
              <label key={k} className="flex items-center justify-between gap-2">
                <span className="font-mono text-sm text-text">{k}</span>
                <input
                  type="number"
                  step={1}
                  min={-4}
                  max={4}
                  className={numCls}
                  value={draft.ratingAdjust[k] ?? 0}
                  onChange={(e) => setRating(k, Math.round(Number(e.target.value) || 0))}
                />
              </label>
            ))}
          </div>
        </div>

        {/* Volatility ladder */}
        <div className="mt-6 rounded-2xl border border-border bg-surface p-5 shadow-soft">
          <p className={label}>{pick(lang, 'Volatility → level', 'Volatilidad → nivel')}</p>
          <p className="mt-1 text-xs text-muted">
            {pick(
              lang,
              'When market volatility is known it sets a floor on the level: the first band whose max vol ≥ the instrument’s vol wins (the riskier of this and the rating rule applies).',
              'Cuando se conoce la volatilidad de mercado fija un piso del nivel: gana la primera banda cuyo máx. de vol ≥ la vol del instrumento (se aplica el mayor entre esto y la calificación).',
            )}
          </p>
          <div className="mt-3 space-y-2.5">
            {draft.volThresholds.map((v, i) => (
              <div key={v.level} className="flex items-center gap-3">
                <LevelChip level={v.level} />
                <span className="text-sm text-muted">{pick(lang, 'up to vol', 'hasta vol')}</span>
                {Number.isFinite(v.maxVol) ? (
                  <>
                    <input
                      type="number"
                      step={0.01}
                      min={0}
                      className={numCls}
                      value={v.maxVol}
                      onChange={(e) => setVol(i, Math.max(0, Number(e.target.value) || 0))}
                    />
                    <span className="text-sm text-muted">({Math.round(v.maxVol * 100)}%)</span>
                  </>
                ) : (
                  <span className="font-mono text-sm text-muted">∞</span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setParams(clone(draft))}
            disabled={!dirty}
            className="rounded-xl bg-teal px-5 py-2 text-sm font-semibold text-white shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t.adminRisk.save}
          </button>
          {dirty && <span className="text-xs text-muted">{pick(lang, 'Unsaved changes', 'Cambios sin guardar')}</span>}
        </div>
      </div>
    </div>
  )
}
