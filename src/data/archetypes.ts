// An archetype id. Archetypes are ADMIN-DEFINED (add / remove / rename / retune
// on the Archetypes page), so the id is any string. The five below are the seed
// set — each is a point on the two profile axes (risk aversion, liquidity
// preference) plus its bilingual copy and model portfolios. Their asset-class
// mixes double as the admin's allocation PRESETS on the advisor screen.
export type ArchetypeKey = string
// The seed ids, in display order — used to build the default archetype list.
export const SEED_ARCHETYPE_IDS = ['guardian', 'income', 'balanced', 'opportunist', 'builder'] as const

export type Archetype = {
  name: string
  desc: string
  traits: string[]
  products: string[]
}

// Accent color per archetype, used for client-card avatars and chips on the
// advisor pages. Chosen from the app palette to read at a glance.
export const ARCHETYPE_COLORS: Record<ArchetypeKey, string> = {
  guardian: '#378ADD', // blue — capital preservation + liquidity
  income: '#C9933A', // amber — steady income
  balanced: '#5AA98B', // green — diversified middle
  opportunist: '#00C9A7', // teal — nimble, risk-tolerant
  builder: '#E05C5C', // red — long-horizon growth
}

export const ARCHETYPES: Record<ArchetypeKey, Archetype> = {
  guardian: {
    name: 'The Guardian',
    desc: 'You protect capital first and keep it within reach — certainty and access over upside.',
    traits: ['Capital-preserving', 'Values liquidity', 'Low drawdown', 'Conservative'],
    products: [
      'Short-duration investment grade bonds',
      'Treasury bill ladder',
      'Term deposits (CDs)',
      'Money-market and liquid funds',
    ],
  },
  income: {
    name: 'The Income Seeker',
    desc: 'You want steady income and will lock capital up to earn it, as long as risk stays moderate.',
    traits: ['Yield-seeking', 'Accepts lock-ups', 'Moderate risk', 'Income-focused'],
    products: [
      'Investment grade corporate bonds',
      'Sovereign bond ladder',
      'Coupon-paying structured notes',
      'Multi-year investment funds',
    ],
  },
  balanced: {
    name: 'The Balanced',
    desc: 'You split the difference — a diversified mix that balances growth against stability and access.',
    traits: ['Diversified', 'Balanced risk', 'Flexible', 'Middle-of-the-road'],
    products: [
      'Diversified multi-asset ETFs',
      'A blend of bonds and equities',
      'Broad-market index funds',
      'Balanced mutual funds',
    ],
  },
  opportunist: {
    name: 'The Opportunist',
    desc: 'You take on risk but keep your powder dry — nimble positions you can exit to seize the next move.',
    traits: ['Risk-tolerant', 'Values liquidity', 'Tactical', 'Opportunistic'],
    products: [
      'Liquid equity ETFs',
      'Single-name equities',
      'Sector and thematic ETFs',
      'Exchange-traded participation notes',
    ],
  },
  builder: {
    name: 'The Builder',
    desc: 'You back long-horizon growth and can lock capital away for years to compound it.',
    traits: ['Growth-oriented', 'Long horizon', 'Loss-resilient', 'High conviction'],
    products: [
      'Growth and thematic equities',
      'Uncapped participation notes',
      'Private and venture funds',
      'Long-dated equity positions',
    ],
  },
}
