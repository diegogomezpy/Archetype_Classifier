import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { ARCHETYPES, type ArchetypeKey } from '../data/archetypes'
import { type AssetClass } from './instruments'
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

export type ArchetypeConfig = {
  shapeVectors: Record<ShapeArchetype, ShapeScores>
  assetMix: Record<ArchetypeKey, MixSlice[]>
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
// (largest-remainder), sorted desc, zeros dropped.
export function normalizeMix(weights: { assetClass: AssetClass; pct: number }[]): MixSlice[] {
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

export function seedConfig(): ArchetypeConfig {
  const shapeVectors: Record<ShapeArchetype, ShapeScores> = {
    banker: { ...SHAPE_VECTORS.banker },
    venture: { ...SHAPE_VECTORS.venture },
    insurer: { ...SHAPE_VECTORS.insurer },
  }
  const assetMix = {} as Record<ArchetypeKey, MixSlice[]>
  for (const key of ARCHETYPE_ORDER) assetMix[key] = computeDefaultMix(key, shapeVectors)
  return { shapeVectors, assetMix }
}

// ── React context (backend-API backed) ──────────────────────────────────────

type ArchetypeConfigContextValue = {
  config: ArchetypeConfig
  setShapeVectors: (vectors: Record<ShapeArchetype, ShapeScores>) => void
  setAssetMix: (key: ArchetypeKey, mix: MixSlice[]) => void
  /** Regenerate one archetype's mix from the engine using the live vectors. */
  recomputeMix: (key: ArchetypeKey) => MixSlice[]
  reset: () => void
}

const ArchetypeConfigContext = createContext<ArchetypeConfigContextValue>({
  config: seedConfig(),
  setShapeVectors: () => {},
  setAssetMix: () => {},
  recomputeMix: () => [],
  reset: () => {},
})

function mergeWithSeed(partial: Partial<ArchetypeConfig> | null): ArchetypeConfig {
  const seed = seedConfig()
  if (!partial) return seed
  return {
    shapeVectors: { ...seed.shapeVectors, ...(partial.shapeVectors ?? {}) },
    assetMix: { ...seed.assetMix, ...(partial.assetMix ?? {}) },
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
