import { useEffect, useState } from 'react'
import { ASSET_CLASSES, ASSET_CLASS_COLORS, type AssetClass } from '../lib/instruments'
import {
  ARCHETYPE_ORDER,
  SHAPE_ARCHETYPES,
  normalizeMix,
  useArchetypeConfig,
} from '../lib/archetypeConfig'
import type { ShapeArchetype, ShapeScores } from '../lib/scoring'
import type { ArchetypeKey } from '../data/archetypes'
import { useLang, useT } from '../i18n/i18n'
import { assetClassLabel, localizedArchetype } from '../i18n/content'
import AdminNav from '../components/AdminNav'

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const parseNum = (v: string, fallback = 0) => {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : fallback
}

const numInput =
  'w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-text tnum shadow-soft outline-none transition-shadow focus:ring-2 focus:ring-teal/40'

type VectorDraft = Record<ShapeArchetype, ShapeScores>
type MixDraft = Record<ArchetypeKey, Record<AssetClass, string>>

function buildMixDraft(assetMix: ReturnType<typeof useArchetypeConfig>['config']['assetMix']): MixDraft {
  const out = {} as MixDraft
  for (const key of ARCHETYPE_ORDER) {
    const row = {} as Record<AssetClass, string>
    const slices = assetMix[key] ?? []
    for (const cls of ASSET_CLASSES) {
      const found = slices.find((s) => s.assetClass === cls)
      row[cls] = found ? String(found.pct) : '0'
    }
    out[key] = row
  }
  return out
}

export default function AdminArchetypesPage() {
  const t = useT()
  const { lang } = useLang()
  const { config, setShapeVectors, setAssetMix, recomputeMix, reset } = useArchetypeConfig()

  const [vectorDraft, setVectorDraft] = useState<VectorDraft>(config.shapeVectors)
  const [mixDraft, setMixDraft] = useState<MixDraft>(() => buildMixDraft(config.assetMix))

  // Resync drafts whenever the persisted config changes (async load, save, reset).
  useEffect(() => setVectorDraft(config.shapeVectors), [config.shapeVectors])
  useEffect(() => setMixDraft(buildMixDraft(config.assetMix)), [config.assetMix])

  const setAxis = (key: ShapeArchetype, axis: keyof ShapeScores, value: string) =>
    setVectorDraft((d) => ({ ...d, [key]: { ...d[key], [axis]: parseNum(value) } }))

  const saveVectors = () => {
    const cleaned = {} as VectorDraft
    for (const key of SHAPE_ARCHETYPES) {
      cleaned[key] = {
        sigma: clamp(vectorDraft[key].sigma, -1, 1),
        alpha: clamp(vectorDraft[key].alpha, -1, 1),
        lambda: clamp(vectorDraft[key].lambda, -1, 1),
      }
    }
    setShapeVectors(cleaned)
  }

  const setMixCell = (key: ArchetypeKey, cls: AssetClass, value: string) =>
    setMixDraft((d) => ({ ...d, [key]: { ...d[key], [cls]: value } }))

  const mixTotal = (key: ArchetypeKey) =>
    ASSET_CLASSES.reduce((s, cls) => s + Math.max(0, parseNum(mixDraft[key][cls])), 0)

  const saveMix = (key: ArchetypeKey) => {
    const weights = ASSET_CLASSES.map((cls) => ({
      assetClass: cls,
      pct: Math.max(0, parseNum(mixDraft[key][cls])),
    }))
    const normalized = normalizeMix(weights)
    if (normalized.length === 0) return
    setAssetMix(key, normalized)
  }

  const recompute = (key: ArchetypeKey) => {
    const mix = recomputeMix(key)
    setMixDraft((d) => {
      const row = {} as Record<AssetClass, string>
      for (const cls of ASSET_CLASSES) {
        const found = mix.find((s) => s.assetClass === cls)
        row[cls] = found ? String(found.pct) : '0'
      }
      return { ...d, [key]: row }
    })
  }

  const handleReset = () => {
    if (window.confirm(t.adminArch.resetConfirm)) reset()
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-12">
      <AdminNav />

      <div className="mt-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-text">{t.adminArch.title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            {t.adminArch.subtitle}
          </p>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="shrink-0 rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm text-muted transition-colors hover:text-red"
        >
          {t.adminArch.resetDefaults}
        </button>
      </div>

      {/* ── Section 1: risk vectors ─────────────────────────────────────────── */}
      <section className="mt-10">
        <h2 className="font-mono text-xs uppercase tracking-[0.14em] text-muted">
          {t.adminArch.vectorsTitle}
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">{t.adminArch.vectorsHint}</p>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {SHAPE_ARCHETYPES.map((key) => (
            <div key={key} className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
              <h3 className="text-base font-semibold text-text">
                {localizedArchetype(key, lang).name}
              </h3>
              <div className="mt-4 space-y-3">
                {(['sigma', 'alpha', 'lambda'] as const).map((axis) => (
                  <div key={axis} className="flex items-center gap-3">
                    <label className="flex-1 text-sm text-muted">
                      {axis === 'sigma'
                        ? t.adminArch.sigma
                        : axis === 'alpha'
                          ? t.adminArch.alpha
                          : t.adminArch.lambda}
                    </label>
                    <input
                      type="number"
                      step={0.05}
                      min={-1}
                      max={1}
                      className={`${numInput} w-20 text-right`}
                      value={vectorDraft[key][axis]}
                      onChange={(e) => setAxis(key, axis, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-4 rounded-lg bg-surface2/50 px-3 py-2 text-xs leading-snug text-muted">
          {t.adminArch.notVectorNote}
        </p>

        <div className="mt-4">
          <button
            type="button"
            onClick={saveVectors}
            className="rounded-xl bg-teal px-6 py-2.5 text-sm font-semibold text-white shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card"
          >
            {t.adminArch.saveVectors}
          </button>
        </div>
      </section>

      {/* ── Section 2: model asset mix ──────────────────────────────────────── */}
      <section className="mt-14">
        <h2 className="font-mono text-xs uppercase tracking-[0.14em] text-muted">
          {t.adminArch.mixTitle}
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">{t.adminArch.mixHint}</p>

        <div className="mt-5 space-y-4">
          {ARCHETYPE_ORDER.map((key) => {
            const total = mixTotal(key)
            const empty = total <= 0
            return (
              <div key={key} className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-text">
                    {localizedArchetype(key, lang).name}
                  </h3>
                  <span
                    className={`font-mono text-xs tnum ${empty ? 'text-red' : 'text-muted'}`}
                  >
                    {t.adminArch.total}: {total}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2.5 sm:grid-cols-3 lg:grid-cols-4">
                  {ASSET_CLASSES.map((cls) => (
                    <div key={cls} className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: ASSET_CLASS_COLORS[cls] }}
                      />
                      <label className="min-w-0 flex-1 truncate text-xs text-muted">
                        {assetClassLabel(cls, lang)}
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        aria-label={`${localizedArchetype(key, lang).name} — ${assetClassLabel(cls, lang)}`}
                        className={`${numInput} w-16 text-right`}
                        value={mixDraft[key][cls]}
                        onChange={(e) => setMixCell(key, cls, e.target.value)}
                      />
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => saveMix(key)}
                    disabled={empty}
                    className="rounded-xl bg-teal px-5 py-2 text-sm font-semibold text-white shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {t.adminArch.save}
                  </button>
                  <button
                    type="button"
                    onClick={() => recompute(key)}
                    className="rounded-xl px-4 py-2 text-sm font-medium text-muted transition-colors hover:text-text"
                  >
                    {t.adminArch.recompute}
                  </button>
                  {empty && <span className="text-xs text-red">{t.adminArch.sumWarning}</span>}
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
