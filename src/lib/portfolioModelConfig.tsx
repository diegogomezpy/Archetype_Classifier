import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { DEFAULT_PORTFOLIO_MODEL, setActivePortfolioModel, type PortfolioModel } from './portfolio'
import { api } from './api'

// ---------------------------------------------------------------------------
// Portfolio-construction model (admin-editable, persisted in Firestore)
// ---------------------------------------------------------------------------
// The knobs behind the optimizer — risk-free rate, equity premium, the
// analyst/CAPM return blend, per-name cap, assets per class, correlations, the
// risk-level ceiling, and per-band bond duration. Edits take effect live via
// setActivePortfolioModel.

const clone = (m: PortfolioModel): PortfolioModel => JSON.parse(JSON.stringify(m))

// Params later refactors replaced: rhoWithin/rhoAcross by the factor-correlation
// model, assetsPerClass by a single portfolio-wide totalAssets. A doc written
// before those changes still carries them; drop them rather than spreading dead
// keys forward forever.
const RETIRED = ['rhoWithin', 'rhoAcross', 'assetsPerClass'] as const

export function mergeModel(loaded: Partial<PortfolioModel> | null): PortfolioModel {
  const seed = clone(DEFAULT_PORTFOLIO_MODEL)
  if (!loaded) return seed
  const kept = { ...loaded } as Record<string, unknown>
  for (const k of RETIRED) delete kept[k]
  return {
    ...seed,
    ...(kept as Partial<PortfolioModel>),
    bandDuration: { ...seed.bandDuration, ...(loaded.bandDuration ?? {}) } as PortfolioModel['bandDuration'],
    // Nested, and added after the first configs were written — merge key by key
    // so a stored doc from before the factor model still loads with defaults.
    correlation: {
      ...seed.correlation,
      ...(loaded.correlation ?? {}),
      factorRho: { ...seed.correlation.factorRho, ...(loaded.correlation?.factorRho ?? {}) },
    },
  }
}

type PortfolioModelContextValue = {
  model: PortfolioModel
  setModel: (m: PortfolioModel) => void
  reset: () => void
}

const PortfolioModelContext = createContext<PortfolioModelContextValue>({
  model: DEFAULT_PORTFOLIO_MODEL,
  setModel: () => {},
  reset: () => {},
})

export function PortfolioModelProvider({ children }: { children: ReactNode }) {
  const [model, setModelState] = useState<PortfolioModel>(() => clone(DEFAULT_PORTFOLIO_MODEL))

  const persist = (next: PortfolioModel) => {
    setActivePortfolioModel(next)
    setModelState(next)
    void api.put('/config/portfolioModel', next).catch((e) => console.warn('portfolio model save:', e))
  }

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const loaded = await api.get<Partial<PortfolioModel> | null>('/config/portfolioModel')
        const merged = mergeModel(loaded)
        if (alive) {
          setActivePortfolioModel(merged)
          setModelState(merged)
        }
        if (!loaded) void api.put('/config/portfolioModel', merged).catch(() => {})
      } catch {
        // Backend unreachable — keep the built-in defaults.
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const value = useMemo<PortfolioModelContextValue>(
    () => ({ model, setModel: persist, reset: () => persist(clone(DEFAULT_PORTFOLIO_MODEL)) }),
    [model],
  )

  return <PortfolioModelContext.Provider value={value}>{children}</PortfolioModelContext.Provider>
}

export function usePortfolioModel(): PortfolioModelContextValue {
  return useContext(PortfolioModelContext)
}
