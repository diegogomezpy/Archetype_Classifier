import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { ARCHETYPES, ARCHETYPE_COLORS, SEED_ARCHETYPE_IDS } from '../data/archetypes'
import { ARCHETYPES_ES, setActiveBands, type ActiveBand } from '../i18n/content'
import { ASSET_CLASSES, type AssetClass, type LocalCategory } from './instruments'
import {
  BAND_THRESHOLDS,
  RISK_LEVELS,
  computeAllocation,
  type AxisScores,
  type RiskLevel,
} from './scoring'
import { api } from './api'

// ---------------------------------------------------------------------------
// Risk bands (admin-defined presets)
// ---------------------------------------------------------------------------
// The classification is a fixed 1–5 risk band on the risk-aversion axis. Each
// band is an admin-curated preset: its bilingual copy, accent color, and its
// recommended GLOBAL + LOCAL asset-class mixes (the top-level split the advisor
// screen optimizes within). The set is exactly five — the admin edits each band
// but can't add or remove. Persists behind the async store so presets retune
// without a code change.

export type MixSlice = { assetClass: AssetClass; pct: number }
export type LocalMixSlice = { assetClass: LocalCategory; pct: number }

type Bi = { en: string; es: string }

export type RiskBand = {
  level: RiskLevel
  color: string
  name: Bi
  desc: Bi
  mix: MixSlice[] // GLOBAL model portfolio (international asset classes)
  localMix: LocalMixSlice[] // LOCAL model portfolio (Cadiem categories)
}

export type BandConfig = { bands: RiskBand[] }

// Config version — bump when the persisted shape changes so a stale doc reseeds.
const CONFIG_VERSION = 1

// ── Normalization ────────────────────────────────────────────────────────────
// Turn any non-negative weights into integer percentages summing to 100
// (largest-remainder), sorted desc, zeros dropped.
export function normalizeMix<C extends string>(
  weights: { assetClass: C; pct: number }[],
): { assetClass: C; pct: number }[] {
  const positive = weights.filter((w) => w.pct > 0)
  const total = positive.reduce((s, w) => s + w.pct, 0)
  if (total <= 0) return []
  const scaled = positive.map((w) => ({ assetClass: w.assetClass, raw: (w.pct / total) * 100 }))
  const floored = scaled.map((w) => ({ ...w, pct: Math.floor(w.raw) }))
  let remainder = 100 - floored.reduce((s, w) => s + w.pct, 0)
  floored
    .slice()
    .sort((a, b) => b.raw - Math.floor(b.raw) - (a.raw - Math.floor(a.raw)))
    .forEach((w) => {
      if (remainder > 0) {
        w.pct++
        remainder--
      }
    })
  return floored
    .filter((w) => w.pct > 0)
    .map((w) => ({ assetClass: w.assetClass, pct: w.pct }))
    .sort((a, b) => b.pct - a.pct)
}

// ── Seeding ──────────────────────────────────────────────────────────────────
// A representative point in each band, used to derive its starter mixes. Midpoint
// of the band's risk-aversion range, neutral liquidity.
function seedVector(level: RiskLevel): AxisScores {
  const t = BAND_THRESHOLDS.find((b) => b.level === level)!
  return { riskAversion: (t.min + t.max) / 2, liquidity: 0 }
}

/** The bundled seed bands (Nivel 1 … 5), copy carried from the seed archetypes. */
export function seedBands(): RiskBand[] {
  return RISK_LEVELS.map((level) => {
    const id = SEED_ARCHETYPE_IDS[level - 1]
    const en = ARCHETYPES[id]
    const es = ARCHETYPES_ES[id]
    const vector = seedVector(level)
    return {
      level,
      color: ARCHETYPE_COLORS[id] ?? '#8A8D99',
      name: { en: en.name, es: es.name },
      desc: { en: en.desc, es: es.desc },
      mix: computeAllocation(vector, 'global') as MixSlice[],
      localMix: computeAllocation(vector, 'local') as LocalMixSlice[],
    }
  })
}

export function seedConfig(): BandConfig {
  return { bands: seedBands() }
}

// ── Migration ────────────────────────────────────────────────────────────────
// Asset classes retired in the taxonomy cut, mapped onto their replacement.
const RETIRED_CLASSES: Record<string, AssetClass | null> = {
  'Income structures': 'Structured notes',
  'Growth structures': 'Structured notes',
  Alternatives: null,
  Crypto: null,
  'Cash/MMF': null,
}

/** Fold retired global classes into their replacement, drop the rest, renorm to 100. */
function sanitizeMix(slices: MixSlice[] | undefined): MixSlice[] {
  if (!slices?.length) return []
  const byClass = new Map<AssetClass, number>()
  for (const s of slices) {
    const mapped = s.assetClass in RETIRED_CLASSES ? RETIRED_CLASSES[s.assetClass] : s.assetClass
    if (!mapped || !ASSET_CLASSES.includes(mapped)) continue
    byClass.set(mapped, (byClass.get(mapped) ?? 0) + (s.pct || 0))
  }
  return normalizeMix([...byClass.entries()].map(([assetClass, pct]) => ({ assetClass, pct })))
}

/**
 * Bring any stored doc onto the current shape. A valid five-band doc is used
 * as-is (mixes sanitized); anything else (an empty store, or the legacy
 * archetype/σ-α-λ config) reseeds cleanly — the old model is discarded.
 */
export function mergeWithSeed(raw: unknown): BandConfig {
  const partial = (raw ?? {}) as { version?: number; bands?: unknown }
  const arr = Array.isArray(partial.bands) ? (partial.bands as RiskBand[]) : null
  const looksValid =
    partial.version === CONFIG_VERSION &&
    arr != null &&
    RISK_LEVELS.every((lvl) => arr.some((b) => b?.level === lvl))
  if (!looksValid || !arr) return seedConfig()

  const seed = seedBands()
  const bands = RISK_LEVELS.map((level) => {
    const stored = arr.find((b) => b.level === level)
    const base = seed[level - 1]
    if (!stored) return base
    return {
      level,
      color: stored.color || base.color,
      name: { en: stored.name?.en || base.name.en, es: stored.name?.es || base.name.es },
      desc: { en: stored.desc?.en ?? base.desc.en, es: stored.desc?.es ?? base.desc.es },
      mix: sanitizeMix(stored.mix).length ? sanitizeMix(stored.mix) : base.mix,
      localMix: normalizeMix<LocalCategory>(stored.localMix ?? []).length
        ? normalizeMix<LocalCategory>(stored.localMix ?? [])
        : base.localMix,
    }
  })
  return { bands }
}

// Push the live bands into the copy resolver (i18n content) so every call site
// resolves name/desc/color by level without threading config through the tree.
function applyActive(cfg: BandConfig): void {
  setActiveBands(
    cfg.bands.map<ActiveBand>((b) => ({
      level: b.level,
      color: b.color,
      name: b.name,
      desc: b.desc,
    })),
  )
}

// ── React context (backend-API backed) ──────────────────────────────────────

type BandConfigContextValue = {
  config: BandConfig
  /** Merge a partial patch into one band (name/desc/color/mix/localMix). */
  updateBand: (level: RiskLevel, patch: Partial<RiskBand>) => void
  setMix: (level: RiskLevel, mix: MixSlice[]) => void
  setLocalMix: (level: RiskLevel, mix: LocalMixSlice[]) => void
  /** Regenerate one band's mix from its representative point via the engine. */
  recomputeMix: (level: RiskLevel) => MixSlice[]
  recomputeLocalMix: (level: RiskLevel) => LocalMixSlice[]
  reset: () => void
}

const BandConfigContext = createContext<BandConfigContextValue>({
  config: seedConfig(),
  updateBand: () => {},
  setMix: () => {},
  setLocalMix: () => {},
  recomputeMix: () => [],
  recomputeLocalMix: () => [],
  reset: () => {},
})

export function RiskBandsProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<BandConfig>(() => {
    const seed = seedConfig()
    applyActive(seed)
    return seed
  })

  const persist = (next: BandConfig) => {
    applyActive(next)
    setConfig(next)
    void api
      .put('/config/riskBands', { version: CONFIG_VERSION, bands: next.bands })
      .catch((e) => console.warn('bands save:', e))
  }

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const loaded = await api.get<unknown>('/config/riskBands')
        const merged = mergeWithSeed(loaded)
        if (alive) {
          applyActive(merged)
          setConfig(merged)
        }
        // Seed an empty store, and overwrite a stale/legacy doc, so it converges.
        if ((loaded as { version?: number })?.version !== CONFIG_VERSION) {
          void api
            .put('/config/riskBands', { version: CONFIG_VERSION, bands: merged.bands })
            .catch(() => {})
        }
      } catch {
        // Backend unreachable — keep the seeded defaults.
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const value = useMemo<BandConfigContextValue>(() => {
    const replace = (bands: RiskBand[]) => persist({ bands })
    const patchOne = (level: RiskLevel, fn: (b: RiskBand) => RiskBand) =>
      replace(config.bands.map((b) => (b.level === level ? fn(b) : b)))
    const repVector = (level: RiskLevel) => seedVector(level)
    return {
      config,
      updateBand: (level, patch) => patchOne(level, (b) => ({ ...b, ...patch })),
      setMix: (level, mix) => patchOne(level, (b) => ({ ...b, mix })),
      setLocalMix: (level, mix) => patchOne(level, (b) => ({ ...b, localMix: mix })),
      recomputeMix: (level) => computeAllocation(repVector(level), 'global') as MixSlice[],
      recomputeLocalMix: (level) => computeAllocation(repVector(level), 'local') as LocalMixSlice[],
      reset: () => persist(seedConfig()),
    }
  }, [config])

  return <BandConfigContext.Provider value={value}>{children}</BandConfigContext.Provider>
}

export function useRiskBands(): BandConfigContextValue {
  return useContext(BandConfigContext)
}

/** The band preset for a given level (falls back to the seed). */
export function bandForLevel(config: BandConfig, level: RiskLevel): RiskBand {
  return config.bands.find((b) => b.level === level) ?? seedBands()[level - 1]
}
