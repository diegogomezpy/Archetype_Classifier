import type { Round } from '../types'

// All amounts in USD, $10,000 input, 1-year horizon (multi-year where noted).
// "Growth" (X) is the more aggressive / higher-variance / more skew-seeking
// side; "Steady" (Y) is the more conservative / carry / protected side. The
// scoring signal is monotone: more Growth = higher sigma, higher alpha,
// lower lambda.
//
// 13 rounds split across two screens (7 + 6). The progress indicator spans all
// 13 rounds.
//
// Allocation rounds render via RoundDecision + PayoffBar, which always show
// outcomes as gains/losses vs the $10,000 input. (`displayMode` is retained on
// the type for compatibility but the payoff bar is always relative.)
//
// Liquidity icons use the names the Icon component renders: 'lock' (lockup),
// 'refresh' (fully liquid), and 'door-exit' (the soft-lockup / can-exit side).
// Liquidity premiums are kept modest so the lockup and liquid options sit
// close together — the choice is a genuine trade-off, not an obvious win.
export const ROUNDS: Round[] = [
  // ════════════════════ SCREEN 1 ════════════════════

  // R1 — Variance, gain-only. No loss psychology. Pure σ.
  // EV matched: X = 0.20×12500 + 0.80×10000 = 10500. Y = 0.80×10625 + 0.20×10000 = 10500.
  {
    id: 1,
    screen: 1,
    type: 'alloc',
    tag: 'Variance',
    displayMode: 'relative',
    q: 'Both sides always return a profit. One has a larger potential upside.',
    sub: 'How do you split your $10,000?',
    x: {
      label: 'Bigger upside',
      scenarios: [
        { p: '20%', amt: 12500, note: 'great year' },
        { p: '80%', amt: 10000, note: 'flat year' },
      ],
    },
    y: {
      label: 'Steady gain',
      scenarios: [
        { p: '80%', amt: 10625, note: 'good year' },
        { p: '20%', amt: 10000, note: 'flat year' },
      ],
    },
  },

  // R2 — Downside. Growth can lose money, Steady cannot. σ + λ signal.
  // EV matched: X = 0.70×11500 + 0.30×8167 = 10500. Y = 0.80×10625 + 0.20×10000 = 10500.
  {
    id: 2,
    screen: 1,
    type: 'alloc',
    tag: 'Downside',
    displayMode: 'relative',
    q: 'The Growth side can lose money. The Steady side always returns a profit.',
    sub: 'Both have the same expected return.',
    x: {
      label: 'Can lose money',
      scenarios: [
        { p: '70%', amt: 11500, note: 'good year' },
        { p: '30%', amt: 8167, note: 'loss' },
      ],
    },
    y: {
      label: 'Always profits',
      scenarios: [
        { p: '80%', amt: 10625, note: 'gain' },
        { p: '20%', amt: 10000, note: 'flat' },
      ],
    },
  },

  // R3 — Skew, 20% tail. Positive skew Growth vs negative skew Steady. Pure α.
  // EV matched: X = 0.20×16500 + 0.80×9000 = 10500. Y = 0.80×11250 + 0.20×7500 = 10500.
  {
    id: 3,
    screen: 1,
    type: 'alloc',
    tag: 'Skew',
    displayMode: 'relative',
    q: 'Growth has a rare large upside. Steady has frequent moderate gains but a larger rare loss.',
    sub: 'Same expected return. Which do you prefer?',
    x: {
      label: 'Rare big win',
      scenarios: [
        { p: '20%', amt: 16500, note: 'rare big win' },
        { p: '80%', amt: 9000, note: 'most years' },
      ],
    },
    y: {
      label: 'Steady, rare big loss',
      scenarios: [
        { p: '80%', amt: 11250, note: 'most years' },
        { p: '20%', amt: 7500, note: 'rare big loss' },
      ],
    },
  },

  // R4 — Loss aversion I. Growth: 50/50 with real loss. Steady: guaranteed gain. Pure λ.
  // EV matched: X = 0.50×12000 + 0.50×9000 = 10500. Y = 10500 guaranteed.
  {
    id: 4,
    screen: 1,
    type: 'alloc',
    tag: 'Loss aversion',
    displayMode: 'relative',
    q: 'The Growth side is a 50/50 bet — you could gain $2,000 or lose $1,000.',
    sub: 'The Steady side gives you a guaranteed $500 profit.',
    x: {
      label: '50/50 bet',
      scenarios: [
        { p: '50%', amt: 12000, note: 'win' },
        { p: '50%', amt: 9000, note: 'loss' },
      ],
    },
    y: {
      label: 'Guaranteed +$500',
      scenarios: [{ p: '100%', amt: 10500, note: 'certain' }],
    },
  },

  // R5 — Skew, 5% tail. Tiny-probability jackpot vs high-prob carry. Pure α.
  // EV matched: X = 0.05×29500 + 0.95×9500 = 10500. Y = 0.90×10833 + 0.10×7500 = 10500.
  {
    id: 5,
    screen: 1,
    type: 'alloc',
    tag: 'Lottery',
    displayMode: 'relative',
    q: 'The Growth side has a 1-in-20 chance of a very large gain.',
    sub: 'The Steady side is more predictable. Same expected return.',
    x: {
      label: 'Lottery ticket',
      scenarios: [
        { p: '5%', amt: 29500, note: '1-in-20 chance' },
        { p: '95%', amt: 9500, note: 'most years' },
      ],
    },
    y: {
      label: 'Predictable',
      scenarios: [
        { p: '90%', amt: 10833, note: 'most years' },
        { p: '10%', amt: 7500, note: 'bad year' },
      ],
    },
  },

  // R6 — Loss aversion II. Larger stakes. Growth: 50/50 bigger loss. Steady: guaranteed. Pure λ.
  // EV matched: X = 0.50×14000 + 0.50×7000 = 10500. Y = 10500 guaranteed.
  {
    id: 6,
    screen: 1,
    type: 'alloc',
    tag: 'Stakes',
    displayMode: 'relative',
    q: 'Same structure as before — but the swings are much bigger.',
    sub: 'You could gain $4,000 or lose $3,000. Or take the guaranteed $500.',
    x: {
      label: 'Big 50/50 swing',
      scenarios: [
        { p: '50%', amt: 14000, note: 'win' },
        { p: '50%', amt: 7000, note: 'loss' },
      ],
    },
    y: {
      label: 'Guaranteed +$500',
      scenarios: [{ p: '100%', amt: 10500, note: 'certain' }],
    },
  },

  // R7 — Liquidity I. 1-year lockup vs fully liquid, modest premium. Pure liq.
  {
    id: 7,
    screen: 1,
    type: 'liq',
    tag: 'Liquidity',
    q: 'Would you lock up your money for a year for a slightly higher return?',
    sub: 'You have $10,000 to invest.',
    x: {
      label: 'Lock in for 1 year',
      ret: '+5%',
      ev: 10500,
      icon: 'lock',
      sub: 'Cannot withdraw early. Earns $500.',
    },
    y: {
      label: 'Withdraw anytime',
      ret: '+3.5%',
      ev: 10350,
      icon: 'refresh',
      sub: 'Fully liquid. Earns $350.',
    },
  },

  // ════════════════════ SCREEN 2 ════════════════════

  // R8 — Skew, matched probabilities (25/75). The cleanest α test: mirror-flipped payoffs.
  // EV matched: X = 0.25×16500 + 0.75×8500 = 10500. Y = 0.75×11500 + 0.25×7500 = 10500.
  {
    id: 8,
    screen: 2,
    type: 'alloc',
    tag: 'Payoff shape',
    displayMode: 'relative',
    q: 'Both sides have the same probabilities and the same expected return.',
    sub: 'Only the payoff shape differs. Which feels better?',
    x: {
      label: 'Rare big win',
      scenarios: [
        { p: '25%', amt: 16500, note: 'good year' },
        { p: '75%', amt: 8500, note: 'most years' },
      ],
    },
    y: {
      label: 'Frequent gain',
      scenarios: [
        { p: '75%', amt: 11500, note: 'most years' },
        { p: '25%', amt: 7500, note: 'bad year' },
      ],
    },
  },

  // R9 — Variance + skew combined. σ and α double contribution.
  // EV matched: X = 0.40×13750 + 0.60×8333 = 10500. Y = 0.60×12000 + 0.40×8250 = 10500.
  {
    id: 9,
    screen: 2,
    type: 'alloc',
    tag: 'Risk profile',
    displayMode: 'relative',
    q: 'Both sides are volatile. Growth leans toward upside, Steady leans toward downside.',
    sub: 'Same expected return.',
    x: {
      label: 'Upside-leaning',
      scenarios: [
        { p: '40%', amt: 13750, note: 'gain' },
        { p: '60%', amt: 8333, note: 'loss' },
      ],
    },
    y: {
      label: 'Downside-leaning',
      scenarios: [
        { p: '60%', amt: 12000, note: 'gain' },
        { p: '40%', amt: 8250, note: 'loss' },
      ],
    },
  },

  // R10 — Liquidity II: penalty exit vs hard lockup, same premium. Pure liq (optionality).
  {
    id: 10,
    screen: 2,
    type: 'liq',
    tag: 'Flexibility',
    q: 'Both pay +6% if held for 1 year. The difference is what happens if you need to exit early.',
    sub: 'Would you pay for the option to leave?',
    x: {
      label: 'Hard lockup — 1 year',
      ret: '+6%',
      ev: 10600,
      icon: 'lock',
      sub: 'Cannot exit early under any circumstances. Earns $600 at maturity.',
    },
    y: {
      label: 'Soft lockup — exit with fee',
      ret: '+6%',
      ev: 10600,
      icon: 'door-exit',
      sub: 'Can exit any time, but pay a 2% penalty on early exit. Same return if held to maturity.',
    },
  },

  // R11 — Liquidity III. 3-year lockup vs fully liquid, modest premium. Pure liq.
  {
    id: 11,
    screen: 2,
    type: 'liq',
    tag: 'Long lockup',
    q: 'Would you lock up your money for 3 years for a somewhat higher return?',
    sub: 'You have $10,000 to invest.',
    x: {
      label: 'Lock in for 3 years',
      ret: '+9%',
      ev: 10900,
      icon: 'lock',
      sub: 'Cannot withdraw. Earns $900 over 3 years.',
    },
    y: {
      label: 'Withdraw anytime',
      ret: '+4%',
      ev: 10400,
      icon: 'refresh',
      sub: 'Fully liquid. Earns $400.',
    },
  },

  // R12 — Liquidity IV. Low premium threshold ($100 gap). Minimum acceptable illiquidity premium.
  {
    id: 12,
    screen: 2,
    type: 'liq',
    tag: 'Threshold',
    q: 'A small extra return for giving up liquidity for 1 year.',
    sub: 'Is $100 extra worth losing access to your money for a year?',
    x: {
      label: 'Lock in for 1 year',
      ret: '+6%',
      ev: 10600,
      icon: 'lock',
      sub: 'Cannot withdraw. Earns $600.',
    },
    y: {
      label: 'Withdraw anytime',
      ret: '+5%',
      ev: 10500,
      icon: 'refresh',
      sub: 'Fully liquid. Earns $500.',
    },
  },

  // R13 — Liquidity V. 2-year lockup, modest premium. Completes the liquidity curve.
  {
    id: 13,
    screen: 2,
    type: 'liq',
    tag: 'Commitment',
    q: 'A 2-year lockup with a modest return premium.',
    sub: 'How much does flexibility matter to you?',
    x: {
      label: 'Lock in for 2 years',
      ret: '+8%',
      ev: 10800,
      icon: 'lock',
      sub: 'Cannot withdraw. Earns $800 over 2 years.',
    },
    y: {
      label: 'Withdraw anytime',
      ret: '+5%',
      ev: 10500,
      icon: 'refresh',
      sub: 'Fully liquid. Earns $500.',
    },
  },
]
