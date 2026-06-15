export type ArchetypeKey = 'protector' | 'optimizer' | 'lottery' | 'carry' | 'agnostic'

export type Archetype = {
  name: string
  vec: { sigma: number; alpha: number; lambda: number }
  desc: string
  traits: string[]
  products: string[]
}

export const ARCHETYPES: Record<ArchetypeKey, Archetype> = {
  protector: {
    name: 'The Protector',
    vec: { sigma: -0.7, alpha: -0.2, lambda: 0.8 },
    desc: "You prioritize capital preservation above all. Losses weigh heavily, and you prefer certainty over upside. Your investments should guard what you've built.",
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
    vec: { sigma: 0.3, alpha: 0.1, lambda: -0.3 },
    desc: "You think in expected values. You're not drawn to flashy payoffs or scared of volatility — you just want the math to work. Efficient, disciplined, unsentimental.",
    traits: ['EV-focused', 'Low loss aversion', 'Disciplined', 'Low bias'],
    products: [
      'Low-cost factor ETFs',
      'Plain bond ladders',
      'BVA sovereign notes',
      'Systematic rebalancing strategies',
    ],
  },
  lottery: {
    name: 'The Lottery Seeker',
    vec: { sigma: 0.6, alpha: 0.9, lambda: -0.5 },
    desc: "You're drawn to asymmetric upside. The chance of a big win is worth more to you than its expected value suggests — and losses don't scare you much.",
    traits: ['Upside-oriented', 'Risk-tolerant', 'Tail-seeking', 'Loss-resilient'],
    products: [
      'Structured notes with uncapped upside',
      'Selective single-name equity',
      'Long-dated equity options',
      'Satellite crypto allocation',
    ],
  },
  carry: {
    name: 'The Carry Collector',
    vec: { sigma: 0.4, alpha: -0.8, lambda: 0.0 },
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
    vec: { sigma: -0.4, alpha: 0.0, lambda: 0.1 },
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
