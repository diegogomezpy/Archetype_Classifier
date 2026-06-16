import type { Round } from '../types'

// All amounts in USD, $10,000 input, 1-year horizon.
// "Growth" (X) is always the more aggressive / higher-variance / skew-seeking
// side; "Anchor" (Y) is the calmer side. Outcomes are framed as gains/losses
// vs. the $10,000 input.
//
// PAIRED ALL-MISMATCHED DESIGN
// ----------------------------
// Every round has a slightly richer side (one side's average outcome is higher
// by ~$200–350) — the gap is never stated; an EV-sensitive player has to spot
// it from the numbers. Rounds come in pairs that share the SAME payoff-shape
// contrast (e.g. high-variance vs low-variance) but flip which side is richer:
//
//   • the "a" round of a pair makes the aggressive side (Growth/X) the richer one
//   • the "b" round makes the calm side (Anchor/Y) the richer one
//
// Scoring then separates two things cleanly (see scoring.ts):
//   • SHAPE (σ, α, λ): the AVERAGE of the pair — the EV pull cancels out, what's
//     left is the player's payoff-shape taste.
//   • EV-DISCIPLINE (ev): the DIFFERENCE within the pair — how much the player
//     chases the richer side even when it fights their shape preference.
//
// Because every shape contrast is tested both ways, EV-discipline is measured
// fairly for every archetype, and "The Optimizer" rides additively on top of
// whatever shape the player has.
//
// 5 contrasts × 2 = 10 rounds, split 5/5 across two screens.
export const ROUNDS: Round[] = [
  // ════════════════════ SCREEN 1 ════════════════════

  // ── Contrast 1 — Variance (σ), gain-only (no losses, so it isolates σ) ──
  // R1a: Growth (high-variance) is richer. X EV = .25×12800+.75×10000 = 10700; Y = .8×10600+.2×10000 = 10480.
  {
    id: 1,
    screen: 1,
    type: 'alloc',
    tag: 'Variance',
    displayMode: 'relative',
    evGap: 220,
    q: 'Both sides always return a profit. One swings wider than the other.',
    sub: 'How do you split your $10,000?',
    x: {
      label: 'Bigger upside',
      scenarios: [
        { p: '25%', amt: 12800, note: 'great year' },
        { p: '75%', amt: 10000, note: 'flat year' },
      ],
    },
    y: {
      label: 'Steadier gain',
      scenarios: [
        { p: '80%', amt: 10600, note: 'good year' },
        { p: '20%', amt: 10000, note: 'flat year' },
      ],
    },
  },

  // ── Contrast 2 — Skew (α): positive-skew vs negative-skew ──
  // R2a: Growth (positive-skew) is richer. X EV = .15×16500+.85×9350 = 10422; Y = .85×10550+.15×8200 = 10197.
  {
    id: 2,
    screen: 1,
    type: 'alloc',
    tag: 'Skew',
    displayMode: 'relative',
    evGap: 225,
    q: 'Growth has a rare large upside. Anchor gains often but has a rare large loss.',
    sub: 'Which payoff shape do you prefer?',
    x: {
      label: 'Rare big win',
      scenarios: [
        { p: '15%', amt: 16500, note: 'rare big win' },
        { p: '85%', amt: 9350, note: 'most years' },
      ],
    },
    y: {
      label: 'Frequent gain, rare big loss',
      scenarios: [
        { p: '85%', amt: 10550, note: 'most years' },
        { p: '15%', amt: 8200, note: 'rare big loss' },
      ],
    },
  },

  // ── Contrast 3 — Loss aversion (λ): a 50/50 with a real loss vs a sure gain ──
  // R3a: Growth (the gamble) is richer. X EV = .5×12200+.5×9000 = 10600; Y = 10400.
  {
    id: 3,
    screen: 1,
    type: 'alloc',
    tag: 'Loss aversion',
    displayMode: 'relative',
    evGap: 200,
    q: 'Growth is a 50/50 — you could gain $2,200 or lose $1,000. Anchor is a sure gain.',
    sub: 'How do you split your $10,000?',
    x: {
      label: '50/50 bet',
      scenarios: [
        { p: '50%', amt: 12200, note: 'win' },
        { p: '50%', amt: 9000, note: 'loss' },
      ],
    },
    y: {
      label: 'Guaranteed gain',
      scenarios: [{ p: '100%', amt: 10400, note: 'certain' }],
    },
  },

  // ── Contrast 4 — Combined risk profile (σ + α + λ) ──
  // R4a: Growth (upside-leaning, volatile) is richer. X EV = .4×13800+.6×8400 = 10560; Y = .6×11600+.4×8400 = 10320.
  {
    id: 4,
    screen: 1,
    type: 'alloc',
    tag: 'Risk profile',
    displayMode: 'relative',
    evGap: 240,
    q: 'Both sides are volatile. Growth leans to the upside, Anchor leans to the downside.',
    sub: 'How do you split your $10,000?',
    x: {
      label: 'Upside-leaning swing',
      scenarios: [
        { p: '40%', amt: 13800, note: 'gain' },
        { p: '60%', amt: 8400, note: 'loss' },
      ],
    },
    y: {
      label: 'Downside-leaning swing',
      scenarios: [
        { p: '60%', amt: 11600, note: 'gain' },
        { p: '40%', amt: 8400, note: 'loss' },
      ],
    },
  },

  // ── Contrast 5 — Lottery skew (α), tiny-probability jackpot ──
  // R5a: Growth (jackpot) is richer. X EV = .05×30000+.95×9500 = 10525; Y = .9×10550+.1×8000 = 10295.
  {
    id: 5,
    screen: 1,
    type: 'alloc',
    tag: 'Long shot',
    displayMode: 'relative',
    evGap: 230,
    q: 'Growth has a 1-in-20 shot at a very large gain. Anchor is more predictable.',
    sub: 'How do you split your $10,000?',
    x: {
      label: 'Tiny-chance jackpot',
      scenarios: [
        { p: '5%', amt: 30000, note: '1-in-20 jackpot' },
        { p: '95%', amt: 9500, note: 'most years' },
      ],
    },
    y: {
      label: 'Predictable',
      scenarios: [
        { p: '90%', amt: 10550, note: 'most years' },
        { p: '10%', amt: 8000, note: 'bad year' },
      ],
    },
  },

  // ════════════════════ SCREEN 2 ════════════════════
  // The "b" rounds: same five contrasts, but now the CALM side (Anchor) is the
  // slightly richer one. A pure-shape player answers these the same way they
  // answered screen 1 (so the EV pull cancels); an EV-disciplined player swings
  // toward Anchor here, which is what reveals their EV-discipline.

  // R1b — Variance, gain-only. Anchor richer. X EV = .25×12000+.75×10000 = 10500; Y = .8×10900+.2×10000 = 10720.
  {
    id: 6,
    screen: 2,
    type: 'alloc',
    tag: 'Variance',
    displayMode: 'relative',
    evGap: -220,
    q: 'Both sides always return a profit. One swings wider than the other.',
    sub: 'How do you split your $10,000?',
    x: {
      label: 'Bigger upside',
      scenarios: [
        { p: '25%', amt: 12000, note: 'great year' },
        { p: '75%', amt: 10000, note: 'flat year' },
      ],
    },
    y: {
      label: 'Steadier gain',
      scenarios: [
        { p: '80%', amt: 10900, note: 'good year' },
        { p: '20%', amt: 10000, note: 'flat year' },
      ],
    },
  },

  // R2b — Skew. Anchor richer. X EV = .15×15500+.85×9300 = 10230; Y = .85×10800+.15×8200 = 10410.
  {
    id: 7,
    screen: 2,
    type: 'alloc',
    tag: 'Skew',
    displayMode: 'relative',
    evGap: -180,
    q: 'Growth has a rare large upside. Anchor gains often but has a rare large loss.',
    sub: 'Which payoff shape do you prefer?',
    x: {
      label: 'Rare big win',
      scenarios: [
        { p: '15%', amt: 15500, note: 'rare big win' },
        { p: '85%', amt: 9300, note: 'most years' },
      ],
    },
    y: {
      label: 'Frequent gain, rare big loss',
      scenarios: [
        { p: '85%', amt: 10800, note: 'most years' },
        { p: '15%', amt: 8200, note: 'rare big loss' },
      ],
    },
  },

  // R3b — Loss aversion. Anchor richer. X EV = .5×11800+.5×9000 = 10400; Y = 10600.
  {
    id: 8,
    screen: 2,
    type: 'alloc',
    tag: 'Loss aversion',
    displayMode: 'relative',
    evGap: -200,
    q: 'Growth is a 50/50 — you could gain $1,800 or lose $1,000. Anchor is a sure gain.',
    sub: 'How do you split your $10,000?',
    x: {
      label: '50/50 bet',
      scenarios: [
        { p: '50%', amt: 11800, note: 'win' },
        { p: '50%', amt: 9000, note: 'loss' },
      ],
    },
    y: {
      label: 'Guaranteed gain',
      scenarios: [{ p: '100%', amt: 10600, note: 'certain' }],
    },
  },

  // R4b — Combined risk profile. Anchor richer. X EV = .4×13000+.6×8400 = 10240; Y = .6×12000+.4×8400 = 10560.
  {
    id: 9,
    screen: 2,
    type: 'alloc',
    tag: 'Risk profile',
    displayMode: 'relative',
    evGap: -320,
    q: 'Both sides are volatile. Growth leans to the upside, Anchor leans to the downside.',
    sub: 'How do you split your $10,000?',
    x: {
      label: 'Upside-leaning swing',
      scenarios: [
        { p: '40%', amt: 13000, note: 'gain' },
        { p: '60%', amt: 8400, note: 'loss' },
      ],
    },
    y: {
      label: 'Downside-leaning swing',
      scenarios: [
        { p: '60%', amt: 12000, note: 'gain' },
        { p: '40%', amt: 8400, note: 'loss' },
      ],
    },
  },

  // R5b — Lottery skew. Anchor richer. X EV = .05×26000+.95×9500 = 10325; Y = .9×10800+.1×8000 = 10520.
  {
    id: 10,
    screen: 2,
    type: 'alloc',
    tag: 'Long shot',
    displayMode: 'relative',
    evGap: -195,
    q: 'Growth has a 1-in-20 shot at a very large gain. Anchor is more predictable.',
    sub: 'How do you split your $10,000?',
    x: {
      label: 'Tiny-chance jackpot',
      scenarios: [
        { p: '5%', amt: 26000, note: '1-in-20 jackpot' },
        { p: '95%', amt: 9500, note: 'most years' },
      ],
    },
    y: {
      label: 'Predictable',
      scenarios: [
        { p: '90%', amt: 10800, note: 'most years' },
        { p: '10%', amt: 8000, note: 'bad year' },
      ],
    },
  },
]
