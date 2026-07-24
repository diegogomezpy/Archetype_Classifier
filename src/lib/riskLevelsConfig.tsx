import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { RISK_LEVEL_PARAMS, setActiveRiskLevels, type RiskLevelParams } from './riskLevels'
import { api } from './api'

// ---------------------------------------------------------------------------
// Risk-level rules (admin-editable, persisted in Firestore)
// ---------------------------------------------------------------------------
// The rules that turn (asset class + credit rating + volatility) into a 1–5
// level. Seeded from the built-ins; the admin "Risk model" page persists edits
// and they take effect immediately for every consumer (via setActiveRiskLevels).

const clone = (p: RiskLevelParams): RiskLevelParams => JSON.parse(JSON.stringify(p))

export function mergeLevelParams(loaded: Partial<RiskLevelParams> | null): RiskLevelParams {
  const seed = clone(RISK_LEVEL_PARAMS)
  if (!loaded) return seed
  return {
    baseLevel: { ...seed.baseLevel, ...(loaded.baseLevel ?? {}) } as RiskLevelParams['baseLevel'],
    localBaseLevel: {
      ...seed.localBaseLevel,
      ...(loaded.localBaseLevel ?? {}),
    } as RiskLevelParams['localBaseLevel'],
    ratingAdjust: { ...seed.ratingAdjust, ...(loaded.ratingAdjust ?? {}) },
    volThresholds: loaded.volThresholds?.length ? loaded.volThresholds : seed.volThresholds,
  }
}

type RiskLevelsContextValue = {
  params: RiskLevelParams
  setParams: (p: RiskLevelParams) => void
  reset: () => void
}

const RiskLevelsContext = createContext<RiskLevelsContextValue>({
  params: RISK_LEVEL_PARAMS,
  setParams: () => {},
  reset: () => {},
})

export function RiskLevelsProvider({ children }: { children: ReactNode }) {
  const [params, setParamsState] = useState<RiskLevelParams>(() => clone(RISK_LEVEL_PARAMS))

  const persist = (next: RiskLevelParams) => {
    setActiveRiskLevels(next)
    setParamsState(next)
    void api.put('/config/riskLevels', next).catch((e) => console.warn('risk levels save:', e))
  }

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const loaded = await api.get<Partial<RiskLevelParams> | null>('/config/riskLevels')
        const merged = mergeLevelParams(loaded)
        if (alive) {
          setActiveRiskLevels(merged)
          setParamsState(merged)
        }
        if (!loaded) void api.put('/config/riskLevels', merged).catch(() => {})
      } catch {
        // Backend unreachable — keep the built-in defaults.
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const value = useMemo<RiskLevelsContextValue>(
    () => ({ params, setParams: persist, reset: () => persist(clone(RISK_LEVEL_PARAMS)) }),
    [params],
  )

  return <RiskLevelsContext.Provider value={value}>{children}</RiskLevelsContext.Provider>
}

export function useRiskLevels(): RiskLevelsContextValue {
  return useContext(RiskLevelsContext)
}
