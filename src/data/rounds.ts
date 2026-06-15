import type { Round } from '../types'

// All amounts in USD, $10,000 input, 1-year horizon (multi-year where noted).
// X is the more aggressive / higher-variance / more skew-seeking side; Y is the
// more conservative / carry / protected side. The scoring signal is monotone:
// more X = higher sigma, higher alpha, lower lambda.
//
// 16 rounds split across two screens of 8. The progress bar spans all 16.
//
// Allocation rounds render via RoundDecision + PayoffBar, which always show
// outcomes as gains/losses vs the $10,000 input. (`displayMode` is retained on
// the type for compatibility but the payoff bar is always relative.)
//
// Liquidity icons use the names the Icon component renders: 'lock' (lockup),
// 'refresh' (fully liquid), and 'door-exit' (R13's soft-lockup / can-exit side).
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
    q: 'Both investments always return a profit. One has a larger potential upside.',
    sub: 'How do you split your $10,000?',
    x: {
      label: 'Investment X',
      scenarios: [
        { p: '20%', amt: 12500, note: 'great year' },
        { p: '80%', amt: 10000, note: 'flat year' },
      ],
    },
    y: {
      label: 'Investment Y',
      scenarios: [
        { p: '80%', amt: 10625, note: 'good year' },
        { p: '20%', amt: 10000, note: 'flat year' },
      ],
    },
  },

  // R2 — Downside. X can lose money, Y cannot. σ + λ signal.
  // EV matched: X = 0.70×11500 + 0.30×8167 = 10500. Y = 0.80×10625 + 0.20×10000 = 10500.
  {
    id: 2,
    screen: 1,
    type: 'alloc',
    tag: 'Downside',
    displayMode: 'relative',
    q: 'Investment X can lose money. Investment Y always returns a profit.',
    sub: 'Both have the same expected return.',
    x: {
      label: 'Investment X',
      scenarios: [
        { p: '70%', amt: 11500, note: 'good year' },
        { p: '30%', amt: 8167, note: 'loss' },
      ],
    },
    y: {
      label: 'Investment Y',
      scenarios: [
        { p: '80%', amt: 10625, note: 'gain' },
        { p: '20%', amt: 10000, note: 'flat' },
      ],
    },
  },

  // R3 — Skew, 20% tail. Positive skew X vs negative skew Y. Pure α.
  // EV matched: X = 0.20×16500 + 0.80×9000 = 10500. Y = 0.80×11250 + 0.20×7500 = 10500.
  {
    id: 3,
    screen: 1,
    type: 'alloc',
    tag: 'Skew',
    displayMode: 'relative',
    q: 'X has a rare large upside. Y has a frequent moderate gain but a larger rare loss.',
    sub: 'Same expected return. Which do you prefer?',
    x: {
      label: 'Investment X',
      scenarios: [
        { p: '20%', amt: 16500, note: 'rare big win' },
        { p: '80%', amt: 9000, note: 'most years' },
      ],
    },
    y: {
      label: 'Investment Y',
      scenarios: [
        { p: '80%', amt: 11250, note: 'most years' },
        { p: '20%', amt: 7500, note: 'rare big loss' },
      ],
    },
  },

  // R4 — Loss aversion I. X: 50/50 with real loss. Y: guaranteed gain. Pure λ.
  // EV matched: X = 0.50×12000 + 0.50×9000 = 10500. Y = 10500 guaranteed.
  {
    id: 4,
    screen: 1,
    type: 'alloc',
    tag: 'Loss aversion',
    displayMode: 'relative',
    q: 'Investment X is a 50/50 bet — you could gain $2,000 or lose $1,000.',
    sub: 'Investment Y gives you a guaranteed $500 profit.',
    x: {
      label: 'Investment X',
      scenarios: [
        { p: '50%', amt: 12000, note: 'win' },
        { p: '50%', amt: 9000, note: 'loss' },
      ],
    },
    y: {
      label: 'Investment Y (guaranteed)',
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
    q: 'Investment X has a 1-in-20 chance of a very large gain.',
    sub: 'Investment Y is more predictable. Same expected return.',
    x: {
      label: 'Investment X',
      scenarios: [
        { p: '5%', amt: 29500, note: '1-in-20 chance' },
        { p: '95%', amt: 9500, note: 'most years' },
      ],
    },
    y: {
      label: 'Investment Y',
      scenarios: [
        { p: '90%', amt: 10833, note: 'most years' },
        { p: '10%', amt: 7500, note: 'bad year' },
      ],
    },
  },

  // R6 — Loss aversion II. Larger stakes. X: 50/50 bigger loss. Y: guaranteed. Pure λ.
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
      label: 'Investment X',
      scenarios: [
        { p: '50%', amt: 14000, note: 'win' },
        { p: '50%', amt: 7000, note: 'loss' },
      ],
    },
    y: {
      label: 'Investment Y (guaranteed)',
      scenarios: [{ p: '100%', amt: 10500, note: 'certain' }],
    },
  },

  // R7 — Ambiguity I. Known lower EV vs unknown higher EV. Probability uncertainty.
  // Not EV-matched by design — the EV premium on Y is what makes the choice non-trivial.
  {
    id: 7,
    screen: 1,
    type: 'alloc',
    tag: 'Uncertainty',
    displayMode: 'relative',
    q: 'Investment Y has a higher expected return — but the probabilities are estimated, not historical.',
    sub: 'X is based on documented historical data.',
    x: {
      label: 'Investment X — documented',
      scenarios: [
        { p: '70%', amt: 11200, note: 'historically observed' },
        { p: '30%', amt: 9071, note: 'historically observed' },
      ],
    },
    y: {
      label: 'Investment Y — estimated',
      scenarios: [
        { p: '~70%', amt: 11900, note: 'estimated' },
        { p: '~30%', amt: 9471, note: 'estimated' },
      ],
      ambig: true,
      ambigNote:
        'Returns depend on Paraguayan agricultural export contracts — limited historical data. Probabilities are estimates.',
    },
  },

  // R8 — Liquidity I. 1-year lockup vs fully liquid. Pure liq.
  // Not EV-matched — the premium is the incentive to lock up.
  {
    id: 8,
    screen: 1,
    type: 'liq',
    tag: 'Liquidity',
    q: 'Would you lock up your money for a year for a higher return?',
    sub: 'You have $10,000 to invest.',
    x: {
      label: 'Lock in for 1 year',
      ret: '+8%',
      ev: 10800,
      icon: 'lock',
      sub: 'Cannot withdraw early. Earns $800.',
    },
    y: {
      label: 'Withdraw anytime',
      ret: '+3%',
      ev: 10300,
      icon: 'refresh',
      sub: 'Fully liquid. Earns $300.',
    },
  },

  // ════════════════════ SCREEN 2 ════════════════════

  // R9 — Skew, matched probabilities (25/75). The cleanest α test: mirror-flipped payoffs.
  // EV matched: X = 0.25×16500 + 0.75×8500 = 10500. Y = 0.75×11500 + 0.25×7500 = 10500.
  {
    id: 9,
    screen: 2,
    type: 'alloc',
    tag: 'Payoff shape',
    displayMode: 'relative',
    q: 'Both investments have the same probabilities and the same expected return.',
    sub: 'Only the payoff shape differs. Which feels better?',
    x: {
      label: 'Investment X',
      scenarios: [
        { p: '25%', amt: 16500, note: 'good year' },
        { p: '75%', amt: 8500, note: 'most years' },
      ],
    },
    y: {
      label: 'Investment Y',
      scenarios: [
        { p: '75%', amt: 11500, note: 'most years' },
        { p: '25%', amt: 7500, note: 'bad year' },
      ],
    },
  },

  // R10 — Variance + skew combined. σ and α double contribution.
  // EV matched: X = 0.40×13750 + 0.60×8333 = 10500. Y = 0.60×12000 + 0.40×8250 = 10500.
  {
    id: 10,
    screen: 2,
    type: 'alloc',
    tag: 'Risk profile',
    displayMode: 'relative',
    q: 'Both investments are volatile. X leans toward upside, Y leans toward downside.',
    sub: 'Same expected return.',
    x: {
      label: 'Investment X',
      scenarios: [
        { p: '40%', amt: 13750, note: 'gain' },
        { p: '60%', amt: 8333, note: 'loss' },
      ],
    },
    y: {
      label: 'Investment Y',
      scenarios: [
        { p: '60%', amt: 12000, note: 'gain' },
        { p: '40%', amt: 8250, note: 'loss' },
      ],
    },
  },

  // R11 — Ambiguity II: product complexity. Identical payoffs, different product.
  // EV matched: both = 0.60×11333 + 0.40×9250 = 10500.
  {
    id: 11,
    screen: 2,
    type: 'alloc',
    tag: 'Complexity',
    displayMode: 'relative',
    q: 'Both investments have identical payoffs. The difference is how they work.',
    sub: 'X is a structured formula product. Y is a simple diversified fund.',
    x: {
      label: 'Investment X — structured formula',
      scenarios: [
        { p: '60%', amt: 11333, note: 'formula triggers' },
        { p: '40%', amt: 9250, note: 'formula misses' },
      ],
      ambig: true,
      ambigNote:
        'Payoff defined by a multi-step barrier formula referencing three underlying assets. Complex but fully specified.',
    },
    y: {
      label: 'Investment Y — diversified fund',
      scenarios: [
        { p: '60%', amt: 11333, note: 'good year' },
        { p: '40%', amt: 9250, note: 'bad year' },
      ],
    },
  },

  // R12 — Ambiguity III: source / geography. Identical payoffs, different source.
  // EV matched: both = 0.70×11200 + 0.30×8867 = 10500.
  {
    id: 12,
    screen: 2,
    type: 'alloc',
    tag: 'Familiarity',
    displayMode: 'relative',
    q: 'Both investments have identical payoffs. The difference is where the return comes from.',
    sub: 'Same expected return, same probabilities.',
    x: {
      label: 'Investment X — Paraguayan assets',
      scenarios: [
        { p: '70%', amt: 11200, note: 'good year' },
        { p: '30%', amt: 8867, note: 'bad year' },
      ],
      ambig: true,
      ambigNote:
        'Returns generated by a basket of Paraguayan sovereign and corporate bonds listed on the BVA.',
    },
    y: {
      label: 'Investment Y — US assets',
      scenarios: [
        { p: '70%', amt: 11200, note: 'good year' },
        { p: '30%', amt: 8867, note: 'bad year' },
      ],
    },
  },

  // R13 — Ambiguity IV + Liquidity: penalty exit vs hard lockup. Ambig + liq joint signal.
  // Not EV-matched — optionality has real value.
  {
    id: 13,
    screen: 2,
    type: 'liq',
    tag: 'Flexibility',
    q: 'Both pay +8% if held for 1 year. The difference is what happens if you need to exit early.',
    sub: 'Would you pay for the option to leave?',
    x: {
      label: 'Hard lockup — 1 year',
      ret: '+8%',
      ev: 10800,
      icon: 'lock',
      sub: 'Cannot exit early under any circumstances. Earns $800 at maturity.',
    },
    y: {
      label: 'Soft lockup — exit with fee',
      ret: '+8%',
      ev: 10800,
      icon: 'door-exit',
      sub: 'Can exit any time, but pay a 2% penalty on early exit. Same return if held to maturity.',
    },
  },

  // R14 — Liquidity II. 3-year lockup vs fully liquid. Pure liq.
  {
    id: 14,
    screen: 2,
    type: 'liq',
    tag: 'Long lockup',
    q: 'Would you lock up your money for 3 years for a much higher return?',
    sub: 'You have $10,000 to invest.',
    x: {
      label: 'Lock in for 3 years',
      ret: '+20%',
      ev: 12000,
      icon: 'lock',
      sub: 'Cannot withdraw. Earns $2,000 over 3 years.',
    },
    y: {
      label: 'Withdraw anytime',
      ret: '+3%',
      ev: 10300,
      icon: 'refresh',
      sub: 'Fully liquid. Earns $300 per year.',
    },
  },

  // R15 — Liquidity III. Low premium threshold ($200 gap). Minimum acceptable illiquidity premium.
  {
    id: 15,
    screen: 2,
    type: 'liq',
    tag: 'Threshold',
    q: 'A small extra return for giving up liquidity for 1 year.',
    sub: 'Is $200 extra worth losing access to your money for a year?',
    x: {
      label: 'Lock in for 1 year',
      ret: '+7%',
      ev: 10700,
      icon: 'lock',
      sub: 'Cannot withdraw. Earns $700.',
    },
    y: {
      label: 'Withdraw anytime',
      ret: '+5%',
      ev: 10500,
      icon: 'refresh',
      sub: 'Fully liquid. Earns $500.',
    },
  },

  // R16 — Liquidity IV. Longer lockup, higher premium. Completes the liquidity curve.
  {
    id: 16,
    screen: 2,
    type: 'liq',
    tag: 'Commitment',
    q: 'A 2-year lockup with a strong return premium.',
    sub: 'How much does flexibility matter to you?',
    x: {
      label: 'Lock in for 2 years',
      ret: '+15%',
      ev: 11500,
      icon: 'lock',
      sub: 'Cannot withdraw. Earns $1,500 over 2 years.',
    },
    y: {
      label: 'Withdraw anytime',
      ret: '+3%',
      ev: 10300,
      icon: 'refresh',
      sub: 'Fully liquid. Earns $300 per year.',
    },
  },
]
