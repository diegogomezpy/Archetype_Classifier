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
    desc: "You safeguard capital first. Losses weigh heavily, and you'll give up expected return for certainty — better to protect what you've built than to reach for more.",
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
    desc: "You follow the expected value. When one option pays more on average you take it — risky, safe, flashy or dull doesn't sway you. Models over narrative, math over feel. This is less a risk personality than a discipline that sits on top of one.",
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
    desc: "You back bold bets for the chance at an outsized win. Asymmetric upside is worth more to you than its expected value suggests — a few big winners justify the ones that go nowhere, and you'll pass on a safer, richer option to keep the long-shot.",
    traits: ['Upside-oriented', 'Risk-tolerant', 'Conviction-driven', 'Loss-resilient'],
    products: [
      'Structured notes with uncapped upside',
      'Selective single-name equity',
      'Long-dated equity options',
      'Satellite crypto allocation',
    ],
  },
  insurer: {
    name: 'The Insurer',
    desc: "Like an underwriter, you collect a steady premium for taking on the risks others want to avoid. You're comfortable with the occasional large loss in exchange for reliable income — the professional's trade.",
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
    desc: "You'd rather own the market than try to outguess it. No strong view on direction or payoff shape — you favor simple, transparent, low-cost exposure you can understand and track.",
    traits: ['Transparency-first', 'Low-cost', 'Broad-market', 'Low complexity'],
    products: [
      'MSCI World / S&P 500 trackers',
      'Plain BVA investment grade bonds',
      'Diversified multi-asset ETF',
      'Term deposits',
    ],
  },
}
