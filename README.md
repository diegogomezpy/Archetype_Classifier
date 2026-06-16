# Investor Profile

A gamified investor risk-profiling web app. The client makes a series of quick
investment decisions, and the app builds a behavioral risk profile from those
choices — classifying them into one of five investor archetypes and producing
an advisor-facing dashboard with a suggested asset allocation and a ranked list
of fitting instruments.

Built as a single-page app with **React + TypeScript + Vite + Tailwind CSS** —
no backend, no external UI libraries.

## How it works

The profiler runs as a **10-round game across two screens** (a brief halfway
interstitial sits between them). Every round is an allocation slider: the client
splits $10,000 between two sides. The **Growth** side (`X`) is always the more
aggressive / higher-variance / skew-seeking option; the **Steady** side (`Y`) is
the more conservative one. Outcomes are framed as gains/losses vs. the $10,000
input. Rounds come in two flavors:

- **EV-matched rounds (1–6)** — both sides average exactly $10,500, so the only
  thing the choice reveals is payoff-shape taste (variance, skew, loss aversion).
- **EV-mismatched rounds (7–10)** — one side has a clearly higher average
  outcome. Taking the richer side regardless of its shape is the EV-discipline
  signal. The four rounds place the richer side on a different shape each time
  (risky, safe, positive-skew, negative-skew), so a pure expected-value maximizer
  nets out flat on shape and lights up only the EV axis.

After locking in each round, the app **draws one real outcome** from the
player's chosen distribution and adds it to a running total — a single,
non-re-rollable draw per round, surfaced as "Your run" on the dashboard. The
draw is purely for engagement; the profile is scored only from the *choices*.

Each choice contributes a signed signal to four dimensions:

| Dimension | Meaning |
|-----------|---------|
| **σ (sigma)** | Variance tolerance |
| **α (alpha)** | Skew preference (taste for positive vs. negative skew) |
| **λ (lambda)** | Loss aversion |
| **ev** | EV-discipline (chases the higher expected value vs. a preferred shape) |

The normalized `(σ, α, λ, ev)` vector is matched by **cosine similarity** against
five archetype vectors — **Protector, Optimizer, Lottery Seeker, Carry
Collector, Agnostic**. The `ev` axis is what makes **The Optimizer** reachable: a
client with no strong shape preference who consistently grabs the richer side.
Asset-class allocation and instrument ranking on the advisor dashboard are driven
by the `(σ, α, λ)` shape vector.

## Getting started

**Prerequisites:** Node.js 18+ and npm.

```bash
# Install dependencies
npm install

# Start the dev server (http://localhost:5173)
npm run dev

# Type-check and build for production
npm run build

# Preview the production build locally
npm run preview
```

## Available scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start the Vite dev server with HMR |
| `npm run build` | Type-check (`tsc --noEmit`) and build to `dist/` |
| `npm run typecheck` | Type-check only |
| `npm run preview` | Serve the production build locally |

## Project structure

```
src/
├── App.tsx                 # State machine: intro → playing → interstitial → dashboard
├── main.tsx                # React entry point
├── types.ts                # Shared types (rounds, scores, display modes)
├── index.css               # Tailwind layers + animations
├── components/
│   ├── IntroScreen.tsx     # Landing screen
│   ├── RoundScreen.tsx     # Per-round wrapper → RoundDecision
│   ├── RoundDecision.tsx   # Allocation round: portfolio mix + payoff distribution
│   ├── RoundProgress.tsx   # Segmented per-round progress indicator
│   ├── Coachmarks.tsx      # One-time in-context tutorial (first round)
│   ├── Scoreboard.tsx      # Running capital / profit tally above the bar
│   ├── DrawPointer.tsx     # Spinning pointer that lands on the drawn outcome
│   ├── PayoffBar.tsx       # Canvas payoff-distribution bar (joint outcomes)
│   ├── HalfwayScreen.tsx   # Screen 1 → screen 2 transition
│   ├── AdvisorDashboard.tsx# Two-panel results view
│   ├── ClientPanel.tsx     # Client-facing profile + allocation
│   ├── AdvisorPanel.tsx    # Advisor-only raw scores + talking points
│   ├── DonutChart.tsx      # Pure-SVG allocation donut
│   ├── InstrumentList.tsx  # Ranked instrument fit list
│   └── DimensionScoreBar.tsx
├── data/
│   ├── rounds.ts           # The 10 round definitions
│   └── archetypes.ts       # Archetype copy + target vectors
└── lib/
    ├── scoring.ts          # Scoring pipeline, classification, allocation engine
    ├── outcomes.ts         # Joint payoff distribution + weighted draw sampling
    ├── instruments.ts      # Instrument universe + asset-class loadings
    ├── advisorCopy.ts      # Advisor talking-point generation
    └── format.ts           # Money formatting helper
```

## Notes

- **Desktop-first.** The layout targets desktop widths; it is not yet optimized
  for mobile.
- **No backend.** All scoring runs client-side; nothing is persisted or sent
  anywhere.
- Fonts (DM Mono, Inter) are loaded from Google Fonts at runtime.
- The instrument universe and archetype copy are illustrative sample content.
