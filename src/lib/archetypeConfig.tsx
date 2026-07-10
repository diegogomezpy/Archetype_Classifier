import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { ARCHETYPES, type ArchetypeKey } from '../data/archetypes'
import { type AssetClass, type LocalCategory } from './instruments'
import {
  SHAPE_VECTORS,
  computeAllocation,
  setActiveShapeVectors,
  type ShapeArchetype,
  type ShapeScores,
} from './scoring'
import { api } from './api'

// ---------------------------------------------------------------------------
// Admin-editable archetype configuration
// ---------------------------------------------------------------------------
// Two things the admin curates about each archetype:
//   1. Its payoff-SHAPE vector (σ, α, λ) — the geometry classification uses.
//      Only the three shape archetypes have one; the Quant (EV overlay) and the
//      Indexer (low-conviction fallback) are not directions in shape space.
//   2. Its recommended asset MIX — an explicit model portfolio shown on the
//      advisor dashboard, for all five archetypes.
// Both persist behind an async store (localStorage now, Firestore later) so the
// engine can be retuned without a code change.

export type MixSlice = { assetClass: AssetClass; pct: number }
export type LocalMixSlice = { assetClass: LocalCategory; pct: number }

export type ArchetypeConfig = {
  shapeVectors: Record<ShapeArchetype, ShapeScores>
  // The GLOBAL model portfolio (across the international asset classes).
  assetMix: Record<ArchetypeKey, MixSlice[]>
  // The LOCAL model portfolio (across the Cadiem categories). Independent from
  // the global mix — the advisor dashboard shows both side by side.
  localAssetMix: Record<ArchetypeKey, LocalMixSlice[]>
}

// Display order: shape archetypes first, then the two special cases.
export const ARCHETYPE_ORDER: ArchetypeKey[] = [
  'banker',
  'venture',
  'insurer',
  'quant',
  'indexer',
]

export const SHAPE_ARCHETYPES: ShapeArchetype[] = ['banker', 'venture', 'insurer']

export function archetypeName(key: ArchetypeKey): string {
  return ARCHETYPES[key].name
}

// ── Normalization ────────────────────────────────────────────────────────────
// Turn any non-negative weights into integer percentages summing to 100
// (largest-remainder), sorted desc, zeros dropped. Generic over the category
// type so it serves both the global (AssetClass) and local (LocalCategory) mix.
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
// Defaults reproduce today's behavior: shape vectors are the built-ins, and each
// archetype's mix is the current engine run on that archetype's canonical vector
// (a representative model portfolio). Quant/Indexer use a flat vector — the
// engine special-cases the Quant to 90/10 and gives the Indexer a broad book.
const REP_VECTOR: Record<ArchetypeKey, ShapeScores> = {
  banker: SHAPE_VECTORS.banker,
  venture: SHAPE_VECTORS.venture,
  insurer: SHAPE_VECTORS.insurer,
  quant: { sigma: 0, alpha: 0, lambda: 0 },
  indexer: { sigma: 0, alpha: 0, lambda: 0 },
}

export function computeDefaultMix(key: ArchetypeKey, vectors: Record<ShapeArchetype, ShapeScores>): MixSlice[] {
  const vec = key in vectors ? vectors[key as ShapeArchetype] : REP_VECTOR[key]
  return computeAllocation(key, vec)
}

// Default LOCAL model portfolios (across the 5 Cadiem categories). Hand-set per
// archetype rather than engine-derived — the local menu is bonds/CDs/funds with
// no game-measured shape, so these are sensible starting mixes the admin retunes
// on the Archetypes page. Each sums to 100.
export function seedLocalMix(): Record<ArchetypeKey, LocalMixSlice[]> {
  const m = (
    fixed: number,
    equities: number,
    cds: number,
    mutual: number,
    investment: number,
  ): LocalMixSlice[] =>
    normalizeMix<LocalCategory>([
      { assetClass: 'Fixed income', pct: fixed },
      { assetClass: 'Equities', pct: equities },
      { assetClass: 'CDs', pct: cds },
      { assetClass: 'Mutual funds', pct: mutual },
      { assetClass: 'Investment funds', pct: investment },
    ])
  return {
    //         Fixed  Equ  CDs  Mut  Inv
    banker: m(30, 5, 30, 25, 10), // capital preservation
    venture: m(20, 40, 5, 10, 25), // growth / risk-on
    insurer: m(45, 5, 20, 15, 15), // steady income
    quant: m(55, 30, 0, 5, 10), // concentrated, EV-disciplined
    indexer: m(30, 20, 15, 20, 15), // broad, balanced
  }
}

export function seedConfig(): ArchetypeConfig {
  const shapeVectors: Record<ShapeArchetype, ShapeScores> = {
    banker: { ...SHAPE_VECTORS.banker },
    venture: { ...SHAPE_VECTORS.venture },
    insurer: { ...SHAPE_VECTORS.insurer },
  }
  const assetMix = {} as Record<ArchetypeKey, MixSlice[]>
  for (const key of ARCHETYPE_ORDER) assetMix[key] = computeDefaultMix(key, shapeVectors)
  return { shapeVectors, assetMix, localAssetMix: seedLocalMix() }
}

// ── React context (backend-API backed) ──────────────────────────────────────

type ArchetypeConfigContextValue = {
  config: ArchetypeConfig
  setShapeVectors: (vectors: Record<ShapeArchetype, ShapeScores>) => void
  setAssetMix: (key: ArchetypeKey, mix: MixSlice[]) => void
  setLocalAssetMix: (key: ArchetypeKey, mix: LocalMixSlice[]) => void
  /** Regenerate one archetype's global mix from the engine using the live vectors. */
  recomputeMix: (key: ArchetypeKey) => MixSlice[]
  reset: () => void
}

const ArchetypeConfigContext = createContext<ArchetypeConfigContextValue>({
  config: seedConfig(),
  setShapeVectors: () => {},
  setAssetMix: () => {},
  setLocalAssetMix: () => {},
  recomputeMix: () => [],
  reset: () => {},
})

function mergeWithSeed(partial: Partial<ArchetypeConfig> | null): ArchetypeConfig {
  const seed = seedConfig()
  if (!partial) return seed
  return {
    shapeVectors: { ...seed.shapeVectors, ...(partial.shapeVectors ?? {}) },
    assetMix: { ...seed.assetMix, ...(partial.assetMix ?? {}) },
    localAssetMix: { ...seed.localAssetMix, ...(partial.localAssetMix ?? {}) },
  }
}

export function ArchetypeConfigProvider({ children }: { children: ReactNode }) {
  // Seed synchronously so classification works on first paint; the async load
  // swaps in the persisted config, and the classifier's active vectors follow.
  const [config, setConfig] = useState<ArchetypeConfig>(seedConfig)

  const persist = (next: ArchetypeConfig) => {
    setActiveShapeVectors(next.shapeVectors)
    setConfig(next)
    void api.put('/config/archetypes', next).catch((e) => console.warn('config save:', e))
  }

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const loaded = await api.get<Partial<ArchetypeConfig> | null>('/config/archetypes')
        if (!loaded) {
          // First run: seed the config on the server.
          const seed = seedConfig()
          await api.put('/config/archetypes', seed)
          if (alive) {
            setActiveShapeVectors(seed.shapeVectors)
            setConfig(seed)
          }
        } else {
          const merged = mergeWithSeed(loaded)
          if (alive) {
            setActiveShapeVectors(merged.shapeVectors)
            setConfig(merged)
          }
        }
      } catch {
        // Backend unreachable — keep the seeded defaults.
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const value = useMemo<ArchetypeConfigContextValue>(
    () => ({
      config,
      setShapeVectors: (vectors) => persist({ ...config, shapeVectors: vectors }),
      setAssetMix: (key, mix) =>
        persist({ ...config, assetMix: { ...config.assetMix, [key]: mix } }),
      setLocalAssetMix: (key, mix) =>
        persist({ ...config, localAssetMix: { ...config.localAssetMix, [key]: mix } }),
      recomputeMix: (key) => computeDefaultMix(key, config.shapeVectors),
      reset: () => persist(seedConfig()),
    }),
    [config],
  )

  return (
    <ArchetypeConfigContext.Provider value={value}>{children}</ArchetypeConfigContext.Provider>
  )
}

export function useArchetypeConfig(): ArchetypeConfigContextValue {
  return useContext(ArchetypeConfigContext)
}
