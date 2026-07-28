import { useEffect, useRef, useState } from 'react'
import {
  ASSET_CLASSES,
  ASSET_CLASS_COLORS,
  LOCAL_CATEGORIES,
  LOCAL_CATEGORY_COLORS,
  type AssetClass,
  type LocalCategory,
} from '../lib/instruments'
import { normalizeMix, useRiskBands, type RiskBand } from '../lib/bandConfig'
import { BAND_THRESHOLDS, type RiskLevel } from '../lib/scoring'
import { useLang, useT } from '../i18n/i18n'
import { assetClassLabel, categoryLabel, regionLabel } from '../i18n/content'
import AppNav from '../components/AppNav'
import AdminNav from '../components/AdminNav'

const parseNum = (v: string, fallback = 0) => {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : fallback
}
const pickL = (lang: 'en' | 'es', en: string, es: string) => (lang === 'es' ? es : en)

const numInput =
  'rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-text tnum shadow-soft outline-none transition-shadow focus:ring-2 focus:ring-teal/40'
const textInput =
  'w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text shadow-soft outline-none transition-shadow placeholder:text-muted focus:ring-2 focus:ring-teal/40'
const fieldLabel = 'mb-1 block font-mono text-[10px] uppercase tracking-wider text-muted'

type Draft = {
  level: RiskLevel
  color: string
  nameEn: string
  nameEs: string
  descEn: string
  descEs: string
  mix: Record<AssetClass, string>
  localMix: Record<LocalCategory, string>
}

function toDraft(b: RiskBand): Draft {
  const mix = {} as Record<AssetClass, string>
  for (const c of ASSET_CLASSES) mix[c] = String(b.mix.find((s) => s.assetClass === c)?.pct ?? 0)
  const localMix = {} as Record<LocalCategory, string>
  for (const c of LOCAL_CATEGORIES)
    localMix[c] = String(b.localMix.find((s) => s.assetClass === c)?.pct ?? 0)
  return {
    level: b.level,
    color: b.color,
    nameEn: b.name.en,
    nameEs: b.name.es,
    descEn: b.desc.en,
    descEs: b.desc.es,
    mix,
    localMix,
  }
}

const fmtBound = (v: number) => (v > 0 ? `+${v.toFixed(1)}` : v.toFixed(1))

export default function AdminBandsPage() {
  const t = useT()
  const { lang } = useLang()
  const { config, updateBand, recomputeMix, recomputeLocalMix, reset } = useRiskBands()

  const [drafts, setDrafts] = useState<Draft[]>(() => config.bands.map(toDraft))
  // Reconcile ONLY the band that actually changed. Re-seeding every draft off
  // `config.bands` meant saving band 4 — which produces a fresh array — silently
  // reverted unsaved edits sitting in bands 1-3, and it also ate anything typed
  // before the async config load resolved.
  const persistedRef = useRef(new Map<RiskLevel, string>())
  useEffect(() => {
    setDrafts((prev) => {
      const byLevel = new Map(prev.map((d) => [d.level, d]))
      return config.bands.map((b) => {
        const fresh = toDraft(b)
        const key = JSON.stringify(fresh)
        const lastSeen = persistedRef.current.get(b.level)
        persistedRef.current.set(b.level, key)
        const existing = byLevel.get(b.level)
        // Unseen band, or its persisted content moved → adopt. Otherwise the
        // draft in hand is the admin's, and it stays.
        if (!existing || lastSeen === undefined || lastSeen !== key) return fresh
        return existing
      })
    })
  }, [config.bands])

  const patch = (level: RiskLevel, p: Partial<Draft>) =>
    setDrafts((ds) => ds.map((d) => (d.level === level ? { ...d, ...p } : d)))
  const patchMix = (level: RiskLevel, cls: AssetClass, v: string) =>
    setDrafts((ds) => ds.map((d) => (d.level === level ? { ...d, mix: { ...d.mix, [cls]: v } } : d)))
  const patchLocal = (level: RiskLevel, cat: LocalCategory, v: string) =>
    setDrafts((ds) =>
      ds.map((d) => (d.level === level ? { ...d, localMix: { ...d.localMix, [cat]: v } } : d)),
    )

  const gTotal = (d: Draft) => ASSET_CLASSES.reduce((s, c) => s + Math.max(0, parseNum(d.mix[c])), 0)
  const lTotal = (d: Draft) =>
    LOCAL_CATEGORIES.reduce((s, c) => s + Math.max(0, parseNum(d.localMix[c])), 0)

  const save = (d: Draft) => {
    const mix = normalizeMix(
      ASSET_CLASSES.map((c) => ({ assetClass: c, pct: Math.max(0, parseNum(d.mix[c])) })),
    )
    const localMix = normalizeMix<LocalCategory>(
      LOCAL_CATEGORIES.map((c) => ({ assetClass: c, pct: Math.max(0, parseNum(d.localMix[c])) })),
    )
    updateBand(d.level, {
      color: d.color,
      // Persisted per-language defaults — these are stored values, not UI, so
      // they must NOT follow the current interface language (that would write
      // "Nivel 3" into the English field).
      name: { en: d.nameEn.trim() || `Level ${d.level}`, es: d.nameEs.trim() || d.nameEn.trim() || `Nivel ${d.level}` },
      desc: { en: d.descEn.trim(), es: d.descEs.trim() },
      ...(mix.length ? { mix } : {}),
      ...(localMix.length ? { localMix } : {}),
    })
  }

  const recompute = (level: RiskLevel) => {
    const mix = recomputeMix(level)
    const row = {} as Record<AssetClass, string>
    for (const c of ASSET_CLASSES) row[c] = String(mix.find((s) => s.assetClass === c)?.pct ?? 0)
    patch(level, { mix: row })
  }
  const recomputeLocal = (level: RiskLevel) => {
    const mix = recomputeLocalMix(level)
    const row = {} as Record<LocalCategory, string>
    for (const c of LOCAL_CATEGORIES) row[c] = String(mix.find((s) => s.assetClass === c)?.pct ?? 0)
    patch(level, { localMix: row })
  }

  const handleReset = () => {
    if (window.confirm(t.adminBands.resetConfirm)) reset()
  }

  return (
    <div>
      <AppNav />
      <div className="mx-auto w-full max-w-4xl px-6 py-8">
        <AdminNav />

        <div className="mt-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-text">{t.adminBands.title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{t.adminBands.intro}</p>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="shrink-0 rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm text-muted transition-colors hover:text-red"
          >
            {t.adminBands.resetDefaults}
          </button>
        </div>

        <div className="mt-6 space-y-5">
          {drafts.map((d) => {
            const g = gTotal(d)
            const l = lTotal(d)
            const range = BAND_THRESHOLDS.find((b) => b.level === d.level)
            return (
              <div key={d.level} className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
                {/* Header: level badge + name + threshold range */}
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-mono text-sm font-semibold"
                    style={{ backgroundColor: `${d.color}1f`, color: d.color }}
                  >
                    {d.level}
                  </span>
                  <h3 className="flex-1 text-base font-semibold text-text">
                    {pickL(lang, d.nameEn, d.nameEs) || t.result.level(d.level)}
                  </h3>
                  {range && (
                    <span className="font-mono text-[11px] text-muted tnum">
                      {t.adminBands.rangeLabel}: {fmtBound(range.min)} … {fmtBound(range.max)}
                    </span>
                  )}
                </div>

                {/* Name + color */}
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto]">
                  <div>
                    <label className={fieldLabel}>{pickL(lang, 'Name', 'Nombre')}</label>
                    <div className="flex gap-2">
                      <input className={textInput} value={d.nameEn} placeholder="EN" onChange={(e) => patch(d.level, { nameEn: e.target.value })} />
                      <input className={textInput} value={d.nameEs} placeholder="ES" onChange={(e) => patch(d.level, { nameEs: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <label className={fieldLabel}>{pickL(lang, 'Color', 'Color')}</label>
                    <input
                      type="color"
                      aria-label={`${t.result.level(d.level)} — ${pickL(lang, 'colour', 'color')}`}
                      className="h-9 w-16 cursor-pointer rounded-lg border border-border bg-surface"
                      value={d.color}
                      onChange={(e) => patch(d.level, { color: e.target.value })}
                    />
                  </div>
                </div>

                {/* Description */}
                <div className="mt-4">
                  <label className={fieldLabel}>{pickL(lang, 'Description', 'Descripción')}</label>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <textarea rows={2} className={textInput} value={d.descEn} placeholder="EN" onChange={(e) => patch(d.level, { descEn: e.target.value })} />
                    <textarea rows={2} className={textInput} value={d.descEs} placeholder="ES" onChange={(e) => patch(d.level, { descEs: e.target.value })} />
                  </div>
                </div>

                {/* Model portfolios */}
                <div className="mt-5 grid grid-cols-1 gap-6 border-t border-hairline pt-4 sm:grid-cols-2">
                  <div>
                    <div className="flex items-baseline justify-between border-b border-hairline pb-2">
                      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">{regionLabel('global', lang)}</span>
                      <span className={`font-mono text-xs tnum ${g <= 0 ? 'text-red' : 'text-muted'}`}>{t.adminBands.total}: {g}</span>
                    </div>
                    <div className="mt-3 space-y-2.5">
                      {ASSET_CLASSES.map((cls) => (
                        <label key={cls} className="flex items-center gap-2.5">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: ASSET_CLASS_COLORS[cls] }} />
                          <span className="flex-1 truncate text-sm text-text">{assetClassLabel(cls, lang)}</span>
                          <input type="number" min={0} step={1} className={`${numInput} w-14 text-right`} value={d.mix[cls]} onChange={(e) => patchMix(d.level, cls, e.target.value)} />
                          <span className="w-3 shrink-0 text-xs text-muted">%</span>
                        </label>
                      ))}
                    </div>
                    <button type="button" onClick={() => recompute(d.level)} className="mt-3 text-xs font-medium text-muted transition-colors hover:text-teal">
                      {t.adminBands.recompute}
                    </button>
                  </div>
                  <div className="sm:border-l sm:border-border sm:pl-6">
                    <div className="flex items-baseline justify-between border-b border-hairline pb-2">
                      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">{regionLabel('local', lang)}</span>
                      <span className={`font-mono text-xs tnum ${l <= 0 ? 'text-red' : 'text-muted'}`}>{t.adminBands.total}: {l}</span>
                    </div>
                    <div className="mt-3 space-y-2.5">
                      {LOCAL_CATEGORIES.map((cat) => (
                        <label key={cat} className="flex items-center gap-2.5">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: LOCAL_CATEGORY_COLORS[cat] }} />
                          <span className="flex-1 truncate text-sm text-text">{categoryLabel(cat, 'local', lang)}</span>
                          <input type="number" min={0} step={1} className={`${numInput} w-14 text-right`} value={d.localMix[cat]} onChange={(e) => patchLocal(d.level, cat, e.target.value)} />
                          <span className="w-3 shrink-0 text-xs text-muted">%</span>
                        </label>
                      ))}
                    </div>
                    <button type="button" onClick={() => recomputeLocal(d.level)} className="mt-3 text-xs font-medium text-muted transition-colors hover:text-teal">
                      {t.adminBands.recompute}
                    </button>
                  </div>
                </div>

                <div className="mt-5 border-t border-hairline pt-4">
                  <button
                    type="button"
                    onClick={() => save(d)}
                    className="rounded-xl bg-teal px-5 py-2 text-sm font-semibold text-onAccent shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card"
                  >
                    {t.adminBands.save}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
