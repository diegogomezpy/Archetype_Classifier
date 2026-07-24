import type { Category, LocalCategory, Region } from './instruments'

// ---------------------------------------------------------------------------
// Instrument defaults
// ---------------------------------------------------------------------------
// The σ/α/λ risk-vector derivation was retired — instrument risk is now a 1–5
// LEVEL derived in lib/riskLevels.ts. What remains here are the sensible
// liquidity / lock-up defaults per class (import columns still override them).

/** Sensible liquidity / lock-up defaults per class. */
export function deriveDefaults(
  region: Region,
  category: Category,
): { liquidityTier: 1 | 2 | 3 | 4; lockupMonths: number } {
  if (region === 'local') {
    switch (category as LocalCategory) {
      case 'Fixed income':
        return { liquidityTier: 2, lockupMonths: 0 }
      case 'CDs':
        return { liquidityTier: 3, lockupMonths: 0 }
      case 'Mutual funds':
        return { liquidityTier: 1, lockupMonths: 0 }
      case 'Investment funds':
        return { liquidityTier: 4, lockupMonths: 12 }
      case 'Equities':
        return { liquidityTier: 3, lockupMonths: 0 }
    }
  }
  if (category === 'Structured notes') {
    return { liquidityTier: 4, lockupMonths: 12 }
  }
  return { liquidityTier: 1, lockupMonths: 0 }
}
