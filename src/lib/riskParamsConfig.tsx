import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { RISK_PARAMS, setActiveRiskParams, type RiskParams } from './riskDerivation'
import { api } from './api'

// ---------------------------------------------------------------------------
// Risk-derivation params (admin-editable, persisted in Firestore)
// ---------------------------------------------------------------------------
// The σ/α/λ auto-derivation coefficients. Seeded from the built-ins; the admin
// "Risk model" page persists edits and they take effect immediately for every
// subsequent import (via setActiveRiskParams).

const clone = (p: RiskParams): RiskParams => JSON.parse(JSON.stringify(p))

function mergeParams(loaded: Partial<RiskParams> | null): RiskParams {
  const seed = clone(RISK_PARAMS)
  if (!loaded) return seed
  return {
    ratingRisk: { ...seed.ratingRisk, ...(loaded.ratingRisk ?? {}) },
    local: { ...seed.local, ...(loaded.local ?? {}) } as RiskParams['local'],
    global: { ...seed.global, ...(loaded.global ?? {}) } as RiskParams['global'],
    equityBetaSensitivity: loaded.equityBetaSensitivity ?? seed.equityBetaSensitivity,
  }
}

type RiskParamsContextValue = {
  params: RiskParams
  setParams: (p: RiskParams) => void
  reset: () => void
}

const RiskParamsContext = createContext<RiskParamsContextValue>({
  params: RISK_PARAMS,
  setParams: () => {},
  reset: () => {},
})

export function RiskParamsProvider({ children }: { children: ReactNode }) {
  const [params, setParamsState] = useState<RiskParams>(() => clone(RISK_PARAMS))

  const persist = (next: RiskParams) => {
    setActiveRiskParams(next)
    setParamsState(next)
    void api.put('/config/riskParams', next).catch((e) => console.warn('risk params save:', e))
  }

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const loaded = await api.get<Partial<RiskParams> | null>('/config/riskParams')
        if (!loaded) {
          const seed = clone(RISK_PARAMS)
          await api.put('/config/riskParams', seed)
          if (alive) {
            setActiveRiskParams(seed)
            setParamsState(seed)
          }
        } else {
          const merged = mergeParams(loaded)
          if (alive) {
            setActiveRiskParams(merged)
            setParamsState(merged)
          }
        }
      } catch {
        // Backend unreachable — keep the built-in defaults.
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const value = useMemo<RiskParamsContextValue>(
    () => ({ params, setParams: persist, reset: () => persist(clone(RISK_PARAMS)) }),
    [params],
  )

  return <RiskParamsContext.Provider value={value}>{children}</RiskParamsContext.Provider>
}

export function useRiskParams(): RiskParamsContextValue {
  return useContext(RiskParamsContext)
}
