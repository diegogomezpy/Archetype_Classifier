import { useEffect, useState } from 'react'
import {
  ASSET_CLASSES,
  ASSET_CLASS_COLORS,
  LOCAL_CATEGORIES,
  LOCAL_CATEGORY_COLORS,
  type AssetClass,
  type LocalCategory,
} from '../lib/instruments'
import {
  ARCHETYPE_ORDER,
  SHAPE_ARCHETYPES,
  normalizeMix,
  useArchetypeConfig,
} from '../lib/archetypeConfig'
import type { ShapeArchetype, ShapeScores } from '../lib/scoring'
import type { ArchetypeKey } from '../data/archetypes'
import { useLang, useT } from '../i18n/i18n'
import { assetClassLabel, categoryLabel, localizedArchetype, regionLabel } from '../i18n/content'
import AppNav from '../components/AppNav'
import AdminNav from '../components/AdminNav'

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const parseNum = (v: string, fallback = 0) => {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : fallback
}

// No `w-full` here on purpose: every use sets its own fixed width, and w-full
// would win on CSS order and collapse the sibling label.
const numInput =
  'rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-text tnum shadow-soft outline-none transition-shadow focus:ring-2 focus:ring-teal/40'

type VectorDraft = Record<ShapeArchetype, ShapeScores>
type MixDraft = Record<ArchetypeKey, Record<AssetClass, string>>
type LocalMixDraft = Record<ArchetypeKey, Record<LocalCategory, string>>

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

function buildLocalMixDraft(
  localMix: ReturnType<typeof useArchetypeConfig>['config']['localAssetMix'],
): LocalMixDraft {
  const out = {} as LocalMixDraft
  for (const key of ARCHETYPE_ORDER) {
    const row = {} as Record<LocalCategory, string>
    const slices = localMix[key] ?? []
    for (const cat of LOCAL_CATEGORIES) {
      const found = slices.find((s) => s.assetClass === cat)
      row[cat] = found ? String(found.pct) : '0'
    }
    out[key] = row
  }
  return out
}

export default function AdminArchetypesPage() {
  const t = useT()
  const { lang } = useLang()
  const { config, setShapeVectors, setAssetMix, setLocalAssetMix, recomputeMix, reset } =
    useArchetypeConfig()

  const [vectorDraft, setVectorDraft] = useState<VectorDraft>(config.shapeVectors)
  const [mixDraft, setMixDraft] = useState<MixDraft>(() => buildMixDraft(config.assetMix))
  const [localMixDraft, setLocalMixDraft] = useState<LocalMixDraft>(() =>
    buildLocalMixDraft(config.localAssetMix),
  )

  // Resync drafts whenever the persisted config changes (async load, save, reset).
  useEffect(() => setVectorDraft(config.shapeVectors), [config.shapeVectors])
  useEffect(() => setMixDraft(buildMixDraft(config.assetMix)), [config.assetMix])
  useEffect(() => setLocalMixDraft(buildLocalMixDraft(config.localAssetMix)), [config.localAssetMix])

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

  // ── Local model mix (across the Cadiem categories) ──
  const setLocalMixCell = (key: ArchetypeKey, cat: LocalCategory, value: string) =>
    setLocalMixDraft((d) => ({ ...d, [key]: { ...d[key], [cat]: value } }))

  const localMixTotal = (key: ArchetypeKey) =>
    LOCAL_CATEGORIES.reduce((s, cat) => s + Math.max(0, parseNum(localMixDraft[key][cat])), 0)

  const saveLocalMix = (key: ArchetypeKey) => {
    const weights = LOCAL_CATEGORIES.map((cat) => ({
      assetClass: cat,
      pct: Math.max(0, parseNum(localMixDraft[key][cat])),
    }))
    const normalized = normalizeMix<LocalCategory>(weights)
    if (normalized.length === 0) return
    setLocalAssetMix(key, normalized)
  }

  const handleReset = () => {
    if (window.confirm(t.adminArch.resetConfirm)) reset()
  }

  return (
    <div>
      <AppNav />
      <div className="mx-auto w-full max-w-4xl px-6 py-8">
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

        <p className="mt-4 rounded-lg border border-border bg-surface px-3 py-2 text-xs leading-snug text-muted shadow-soft">
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

      {/* ── Section 2: model mix — global vs local, side by side per archetype ── */}
      <section className="mt-14">
        <h2 className="font-mono text-xs uppercase tracking-[0.14em] text-muted">
          {t.adminArch.mixTitle}
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">{t.adminArch.mixHint}</p>

        <div className="mt-5 space-y-4">
          {ARCHETYPE_ORDER.map((key) => {
            const gTotal = mixTotal(key)
            const lTotal = localMixTotal(key)
            const gEmpty = gTotal <= 0
            const lEmpty = lTotal <= 0
            return (
              <div key={key} className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
                <h3 className="text-base font-semibold text-text">
                  {localizedArchetype(key, lang).name}
                </h3>

                <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2">
                  {/* Global book */}
                  <div>
                    <div className="flex items-baseline justify-between border-b border-hairline pb-2">
                      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
                        {regionLabel('global', lang)}
                      </span>
                      <span className={`font-mono text-xs tnum ${gEmpty ? 'text-red' : 'text-muted'}`}>
                        {t.adminArch.total}: {gTotal}
                      </span>
                    </div>
                    <div className="mt-3 space-y-2.5">
                      {ASSET_CLASSES.map((cls) => (
                        <label key={cls} className="flex items-center gap-2.5">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: ASSET_CLASS_COLORS[cls] }}
                          />
                          <span className="flex-1 truncate text-sm text-text">
                            {assetClassLabel(cls, lang)}
                          </span>
                          <input
                            type="number"
                            min={0}
                            step={1}
                            aria-label={`${localizedArchetype(key, lang).name} — ${regionLabel('global', lang)} — ${assetClassLabel(cls, lang)}`}
                            className={`${numInput} w-14 text-right`}
                            value={mixDraft[key][cls]}
                            onChange={(e) => setMixCell(key, cls, e.target.value)}
                          />
                          <span className="w-3 shrink-0 text-xs text-muted">%</span>
                        </label>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => recompute(key)}
                      className="mt-3 text-xs font-medium text-muted transition-colors hover:text-teal"
                    >
                      {t.adminArch.recompute}
                    </button>
                    {gEmpty && <p className="mt-2 text-xs text-red">{t.adminArch.sumWarning}</p>}
                  </div>

                  {/* Local book */}
                  <div className="sm:border-l sm:border-border sm:pl-6">
                    <div className="flex items-baseline justify-between border-b border-hairline pb-2">
                      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
                        {regionLabel('local', lang)}
                      </span>
                      <span className={`font-mono text-xs tnum ${lEmpty ? 'text-red' : 'text-muted'}`}>
                        {t.adminArch.total}: {lTotal}
                      </span>
                    </div>
                    <div className="mt-3 space-y-2.5">
                      {LOCAL_CATEGORIES.map((cat) => (
                        <label key={cat} className="flex items-center gap-2.5">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: LOCAL_CATEGORY_COLORS[cat] }}
                          />
                          <span className="flex-1 truncate text-sm text-text">
                            {categoryLabel(cat, 'local', lang)}
                          </span>
                          <input
                            type="number"
                            min={0}
                            step={1}
                            aria-label={`${localizedArchetype(key, lang).name} — ${regionLabel('local', lang)} — ${categoryLabel(cat, 'local', lang)}`}
                            className={`${numInput} w-14 text-right`}
                            value={localMixDraft[key][cat]}
                            onChange={(e) => setLocalMixCell(key, cat, e.target.value)}
                          />
                          <span className="w-3 shrink-0 text-xs text-muted">%</span>
                        </label>
                      ))}
                    </div>
                    {lEmpty && <p className="mt-2 text-xs text-red">{t.adminArch.sumWarning}</p>}
                  </div>
                </div>

                <div className="mt-5 border-t border-hairline pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      saveMix(key)
                      saveLocalMix(key)
                    }}
                    disabled={gEmpty && lEmpty}
                    className="rounded-xl bg-teal px-5 py-2 text-sm font-semibold text-white shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {t.adminArch.save}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </section>
      </div>
    </div>
  )
}
