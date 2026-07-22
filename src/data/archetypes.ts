// Archetype keys are the internal identifiers used throughout scoring; the
// `name` field is what the client sees. The payoff-shape signatures (σ, α, λ)
// live in SHAPE_VECTORS in scoring.ts — the single source of truth — so they're
// intentionally NOT duplicated here.
export type ArchetypeKey = 'banker' | 'quant' | 'venture' | 'insurer' | 'indexer'

export type Archetype = {
  name: string
  desc: string
  traits: string[]
  products: string[]
}

// Accent color per archetype, used for client-card avatars and chips on the
// advisor pages. Chosen from the app palette to read at a glance.
export const ARCHETYPE_COLORS: Record<ArchetypeKey, string> = {
  banker: '#378ADD', // blue — capital preservation
  quant: '#9B59B6', // purple — systematic
  venture: '#E05C5C', // red — bold upside
  insurer: '#C9933A', // amber — income
  indexer: '#5AA98B', // teal-green — broad market
}

export const ARCHETYPES: Record<ArchetypeKey, Archetype> = {
  banker: {
    name: 'The Banker',
    desc: "You protect capital first — you'll trade upside for certainty.",
    traits: ['Capital-preserving', 'Prefers certainty', 'Conservative', 'Low drawdown'],
    products: [
      'Capital-protected autocallables',
      'Short-duration investment grade bonds',
      'BVA sovereign bond ladder',
      'Multi-asset ETFs with downside hedge',
    ],
  },
  quant: {
    name: 'The Quant',
    desc: 'You follow the expected value — models over narrative, math over feel.',
    traits: ['EV-driven', 'Shape-indifferent', 'Systematic', 'Low behavioral bias'],
    products: [
      'Low-cost factor ETFs',
      'Plain bond ladders',
      'BVA sovereign notes',
      'Systematic rebalancing strategies',
    ],
  },
  venture: {
    name: 'The Venture Capitalist',
    desc: 'You back bold bets for the shot at an outsized win.',
    traits: ['Upside-oriented', 'Risk-tolerant', 'Conviction-driven', 'Loss-resilient'],
    products: [
      'Structured notes with uncapped upside',
      'Selective single-name equity',
      'Long-dated equity options',
      'Satellite participation notes',
    ],
  },
  insurer: {
    name: 'The Insurer',
    desc: 'You collect steady premium for taking on the risk others avoid.',
    traits: ['Premium-collecting', 'Negative-skew tolerant', 'Yield-seeking', 'Underwrites risk'],
    products: [
      'Autocallable reverse convertibles',
      'Covered-call overlay ETFs',
      'High-yield BVA corporates',
      'Quarterly observation structured notes',
    ],
  },
  indexer: {
    name: 'The Indexer',
    desc: "You'd rather own the market than try to outguess it.",
    traits: ['Transparency-first', 'Low-cost', 'Broad-market', 'Low complexity'],
    products: [
      'MSCI World / S&P 500 trackers',
      'Plain BVA investment grade bonds',
      'Diversified multi-asset ETF',
      'Term deposits',
    ],
  },
}
