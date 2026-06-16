export type ArchetypeKey = 'protector' | 'optimizer' | 'pioneer' | 'carry' | 'agnostic'

export type Archetype = {
  name: string
  vec: { sigma: number; alpha: number; lambda: number; ev: number }
  desc: string
  traits: string[]
  products: string[]
}

export const ARCHETYPES: Record<ArchetypeKey, Archetype> = {
  protector: {
    name: 'The Protector',
    vec: { sigma: -0.7, alpha: -0.2, lambda: 0.8, ev: 0 },
    desc: "You prioritize capital preservation above all. Losses weigh heavily, and you'll give up expected return for certainty. Your investments should guard what you've built.",
    traits: ['Loss-sensitive', 'Prefers certainty', 'Conservative', 'Steady compounder'],
    products: [
      'Capital-protected autocallables',
      'Short-duration investment grade bonds',
      'BVA sovereign bond ladder',
      'Multi-asset ETFs with downside hedge',
    ],
  },
  optimizer: {
    name: 'The Optimizer',
    vec: { sigma: 0.0, alpha: 0.0, lambda: 0.0, ev: 1.0 },
    desc: "You follow the expected value. When one choice pays more on average you take it — whether it looks risky, safe, flashy, or dull doesn't sway you. This is less a risk personality than a discipline that sits on top of one. Efficient, unsentimental.",
    traits: ['EV-driven', 'Shape-indifferent', 'Disciplined', 'Low behavioral bias'],
    products: [
      'Low-cost factor ETFs',
      'Plain bond ladders',
      'BVA sovereign notes',
      'Systematic rebalancing strategies',
    ],
  },
  pioneer: {
    name: 'The Pioneer',
    vec: { sigma: 0.6, alpha: 0.9, lambda: -0.5, ev: 0 },
    desc: "You back the bold bet for the chance at an outsized payoff. Asymmetric upside is worth more to you than its expected value suggests — and you'll pass on a richer, safer option if it means giving up that long-shot potential.",
    traits: ['Upside-oriented', 'Risk-tolerant', 'Conviction-driven', 'Loss-resilient'],
    products: [
      'Structured notes with uncapped upside',
      'Selective single-name equity',
      'Long-dated equity options',
      'Satellite crypto allocation',
    ],
  },
  carry: {
    name: 'The Carry Collector',
    vec: { sigma: 0.4, alpha: -0.8, lambda: 0.0, ev: 0 },
    desc: "You prefer steady premium over lottery tickets. You're comfortable accepting the occasional large loss in exchange for reliable income — the professional's trade.",
    traits: ['Income-focused', 'Negative-skew tolerant', 'Yield-seeking', 'Disciplined on risk'],
    products: [
      'Autocallable reverse convertibles',
      'Covered-call overlay ETFs',
      'High-yield BVA corporates',
      'Quarterly observation structured notes',
    ],
  },
  agnostic: {
    name: 'The Agnostic',
    vec: { sigma: -0.4, alpha: 0.0, lambda: 0.1, ev: 0.0 },
    desc: "You don't have strong views on market direction or payoff shapes. You want straightforward, transparent investments you can understand and trust.",
    traits: ['Transparency-first', 'Familiar assets', 'Moderate risk', 'Low complexity'],
    products: [
      'MSCI World / S&P 500 trackers',
      'Plain BVA investment grade bonds',
      'Diversified multi-asset ETF',
      'Term deposits',
    ],
  },
}
